import { Page, PageRequest } from '@tradedesk/common';
import { Transfer } from './transfer';

export const TRANSFER_REPOSITORY = Symbol('TRANSFER_REPOSITORY');

export interface TransferRepository {
  insert(transfer: Transfer): Promise<void>;
  findByIdempotencyKey(fromUserId: string, idempotencyKey: string): Promise<Transfer | null>;
  /** Returns the transfer only when the user is the sender or the recipient. */
  findByIdForUser(id: string, userId: string): Promise<Transfer | null>;
  listForUser(userId: string, request: PageRequest): Promise<Page<Transfer>>;
}
