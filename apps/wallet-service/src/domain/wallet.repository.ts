import { Wallet } from './wallet';

export const WALLET_REPOSITORY = Symbol('WALLET_REPOSITORY');

export interface WalletRepository {
  /** Creates the wallet when it does not exist yet. Safe to call concurrently. */
  ensureForUser(userId: string): Promise<Wallet>;
  findByUserId(userId: string): Promise<Wallet | null>;
  /**
   * Locks the wallets of the given users (SELECT ... FOR UPDATE) in a stable order (by wallet id),
   * so two transfers between the same users cannot deadlock. Returns them in that order.
   */
  lockByUserIds(userIds: string[]): Promise<Wallet[]>;
  save(wallet: Wallet): Promise<void>;
}
