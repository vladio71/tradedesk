import { Deposit } from '../../../domain/deposit';
import { LedgerEntry } from '../../../domain/ledger-entry';
import { Transfer } from '../../../domain/transfer';
import { Wallet } from '../../../domain/wallet';
import { DepositResponseDto } from '../dto/deposit.dto';
import { LedgerEntryResponseDto, WalletResponseDto } from '../dto/wallet.dto';
import { TransferResponseDto } from '../dto/transfer.dto';

export function toWalletResponse(wallet: Wallet): WalletResponseDto {
  return { id: wallet.id, userId: wallet.userId, balance: wallet.balance.toString(), updatedAt: wallet.updatedAt.toISOString() };
}

export function toLedgerEntryResponse(entry: LedgerEntry): LedgerEntryResponseDto {
  return {
    id: entry.id,
    kind: entry.kind,
    direction: entry.direction,
    amount: entry.amount.toString(),
    balanceAfter: entry.balanceAfter.toString(),
    referenceId: entry.referenceId,
    createdAt: entry.createdAt.toISOString(),
  };
}

export function toDepositResponse(deposit: Deposit): DepositResponseDto {
  return {
    id: deposit.id,
    asset: deposit.asset,
    amount: deposit.amount.toString(),
    usdRate: deposit.usdRate,
    creditAmount: deposit.creditAmount.toString(),
    address: deposit.address,
    status: deposit.status,
    txHash: deposit.txHash,
    createdAt: deposit.createdAt.toISOString(),
    confirmedAt: deposit.confirmedAt ? deposit.confirmedAt.toISOString() : null,
  };
}

export function toTransferResponse(transfer: Transfer, viewerUserId: string): TransferResponseDto {
  return {
    id: transfer.id,
    fromUserId: transfer.fromUserId,
    toUserId: transfer.toUserId,
    amount: transfer.amount.toString(),
    status: transfer.status,
    note: transfer.note,
    direction: transfer.fromUserId === viewerUserId ? 'out' : 'in',
    createdAt: transfer.createdAt.toISOString(),
  };
}
