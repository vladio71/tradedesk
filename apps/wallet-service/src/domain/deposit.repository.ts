import { Page, PageRequest } from '@tradedesk/common';
import { Deposit } from './deposit';

export const DEPOSIT_REPOSITORY = Symbol('DEPOSIT_REPOSITORY');

export interface DepositRepository {
  /** Throws DuplicateIdempotencyKeyError when (user, key) already exists. */
  insert(deposit: Deposit): Promise<void>;
  findByIdempotencyKey(userId: string, idempotencyKey: string): Promise<Deposit | null>;
  findByIdForUser(id: string, userId: string): Promise<Deposit | null>;
  /** Locks the row (SELECT ... FOR UPDATE). This is what makes webhook processing exactly once. */
  findByAddressForUpdate(address: string): Promise<Deposit | null>;
  save(deposit: Deposit): Promise<void>;
  listForUser(userId: string, request: PageRequest): Promise<Page<Deposit>>;
}
