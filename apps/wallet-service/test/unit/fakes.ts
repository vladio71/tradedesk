import { randomUUID } from 'node:crypto';
import { buildPage, Page, PageRequest } from '@tradedesk/common';
import { Deposit } from '../../src/domain/deposit';
import { DepositRepository } from '../../src/domain/deposit.repository';
import { DuplicateIdempotencyKeyError } from '../../src/domain/errors';
import { LedgerEntry } from '../../src/domain/ledger-entry';
import { LedgerFilter, LedgerRepository } from '../../src/domain/ledger.repository';
import { CryptoProvider, WebhookDelivery, WebhookSigner } from '../../src/domain/ports';
import { ReportRepository, VolumeRow } from '../../src/domain/report.repository';
import { Transfer } from '../../src/domain/transfer';
import { TransferRepository } from '../../src/domain/transfer.repository';
import { UnitOfWork, WalletRepositories } from '../../src/domain/unit-of-work';
import { Wallet } from '../../src/domain/wallet';
import { WalletRepository } from '../../src/domain/wallet.repository';
import { CryptoAsset } from '../../src/domain/deposit';

export class InMemoryWalletRepository implements WalletRepository {
  readonly items = new Map<string, Wallet>();

  async ensureForUser(userId: string): Promise<Wallet> {
    const existing = await this.findByUserId(userId);
    if (existing) return existing;
    const wallet = Wallet.open(randomUUID(), userId, new Date());
    this.items.set(wallet.id, wallet);
    return wallet;
  }

  async findByUserId(userId: string): Promise<Wallet | null> {
    return [...this.items.values()].find((wallet) => wallet.userId === userId) ?? null;
  }

  async lockByUserIds(userIds: string[]): Promise<Wallet[]> {
    return [...this.items.values()].filter((wallet) => userIds.includes(wallet.userId)).sort((a, b) => a.id.localeCompare(b.id));
  }

  async save(wallet: Wallet): Promise<void> {
    this.items.set(wallet.id, wallet);
  }
}

export class InMemoryLedgerRepository implements LedgerRepository {
  readonly items: LedgerEntry[] = [];

  async insertMany(entries: LedgerEntry[]): Promise<void> {
    this.items.push(...entries);
  }

  async listForWallet(walletId: string, filter: LedgerFilter): Promise<Page<LedgerEntry>> {
    const rows = this.items.filter((entry) => entry.walletId === walletId && (!filter.kind || entry.kind === filter.kind));
    return buildPage(rows, rows.length, filter);
  }
}

export class InMemoryTransferRepository implements TransferRepository {
  readonly items: Transfer[] = [];

  async insert(transfer: Transfer): Promise<void> {
    this.items.push(transfer);
  }

  async findByIdempotencyKey(fromUserId: string, key: string): Promise<Transfer | null> {
    return this.items.find((transfer) => transfer.fromUserId === fromUserId && transfer.idempotencyKey === key) ?? null;
  }

  async findByIdForUser(id: string, userId: string): Promise<Transfer | null> {
    return this.items.find((t) => t.id === id && (t.fromUserId === userId || t.toUserId === userId)) ?? null;
  }

  async listForUser(userId: string, request: PageRequest): Promise<Page<Transfer>> {
    const rows = this.items.filter((t) => t.fromUserId === userId || t.toUserId === userId);
    return buildPage(rows, rows.length, request);
  }
}

export class InMemoryDepositRepository implements DepositRepository {
  readonly items = new Map<string, Deposit>();

  async insert(deposit: Deposit): Promise<void> {
    if (await this.findByIdempotencyKey(deposit.userId, deposit.idempotencyKey)) {
      throw new DuplicateIdempotencyKeyError();
    }
    this.items.set(deposit.id, deposit);
  }

  async findByIdempotencyKey(userId: string, key: string): Promise<Deposit | null> {
    return [...this.items.values()].find((d) => d.userId === userId && d.idempotencyKey === key) ?? null;
  }

  async findByIdForUser(id: string, userId: string): Promise<Deposit | null> {
    const deposit = this.items.get(id);
    return deposit && deposit.userId === userId ? deposit : null;
  }

  async findByAddressForUpdate(address: string): Promise<Deposit | null> {
    return [...this.items.values()].find((d) => d.address === address) ?? null;
  }

  async save(deposit: Deposit): Promise<void> {
    this.items.set(deposit.id, deposit);
  }

  async listForUser(userId: string, request: PageRequest): Promise<Page<Deposit>> {
    const rows = [...this.items.values()].filter((d) => d.userId === userId);
    return buildPage(rows, rows.length, request);
  }
}

class EmptyReportRepository implements ReportRepository {
  async volumePerDay(): Promise<VolumeRow[]> {
    return [];
  }
}

export class InMemoryUnitOfWork implements UnitOfWork {
  readonly wallets = new InMemoryWalletRepository();
  readonly ledger = new InMemoryLedgerRepository();
  readonly transfers = new InMemoryTransferRepository();
  readonly deposits = new InMemoryDepositRepository();

  run<T>(work: (repositories: WalletRepositories) => Promise<T>): Promise<T> {
    return work({
      wallets: this.wallets,
      ledger: this.ledger,
      transfers: this.transfers,
      deposits: this.deposits,
      reports: new EmptyReportRepository(),
    });
  }

  /** Test helper: gives a user a balance by crediting the wallet directly. */
  async fund(userId: string, amount: string, Money: typeof import('../../src/domain/money').Money): Promise<Wallet> {
    const wallet = await this.wallets.ensureForUser(userId);
    wallet.credit(Money.of(amount), new Date());
    return wallet;
  }
}

let addressCounter = 0;
export class StubCryptoProvider implements CryptoProvider {
  async createDepositAddress(asset: CryptoAsset): Promise<string> {
    addressCounter += 1;
    return `${asset}-address-${addressCounter}`;
  }

  async getUsdRate(asset: CryptoAsset): Promise<string> {
    return asset === 'BTC' ? '50000' : '1';
  }
}

export class StubWebhookSigner implements WebhookSigner {
  sign(rawBody: string | Buffer): string {
    return `sig:${rawBody.toString()}`;
  }

  verify(rawBody: string | Buffer, signature: string): boolean {
    return signature === this.sign(rawBody);
  }
}

export class RecordingWebhookDelivery implements WebhookDelivery {
  readonly sent: { url: string; rawBody: string; signature: string }[] = [];

  async deliver(url: string, rawBody: string, signature: string): Promise<{ status: number; body: unknown }> {
    this.sent.push({ url, rawBody, signature });
    return { status: 200, body: { status: 'confirmed' } };
  }
}
