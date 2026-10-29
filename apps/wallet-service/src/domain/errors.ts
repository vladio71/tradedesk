import { DomainError } from '@tradedesk/common';

export class InvalidMoneyError extends DomainError {
  constructor(reason: string) {
    super('validation', 'INVALID_MONEY', reason);
  }
}

export class InsufficientFundsError extends DomainError {
  constructor() {
    super('validation', 'INSUFFICIENT_FUNDS', 'Not enough balance');
  }
}

export class SelfTransferError extends DomainError {
  constructor() {
    super('validation', 'SELF_TRANSFER', 'You cannot transfer money to yourself');
  }
}

export class IdempotencyKeyReuseError extends DomainError {
  constructor() {
    super('conflict', 'IDEMPOTENCY_KEY_REUSED', 'This Idempotency-Key was already used with a different request');
  }
}

export class TransferNotFoundError extends DomainError {
  constructor() {
    super('not_found', 'TRANSFER_NOT_FOUND', 'Transfer not found');
  }
}

export class DepositNotFoundError extends DomainError {
  constructor() {
    super('not_found', 'DEPOSIT_NOT_FOUND', 'Deposit not found');
  }
}

export class DepositAmountMismatchError extends DomainError {
  constructor() {
    super('validation', 'DEPOSIT_AMOUNT_MISMATCH', 'Received amount does not match the deposit');
  }
}

export class DepositNotPendingError extends DomainError {
  constructor() {
    super('conflict', 'DEPOSIT_NOT_PENDING', 'Deposit is not pending');
  }
}

export class InvalidWebhookSignatureError extends DomainError {
  constructor() {
    super('unauthorized', 'INVALID_WEBHOOK_SIGNATURE', 'Webhook signature is invalid');
  }
}

/** Raised by repositories when the (user, Idempotency-Key) unique index rejects an insert. */
export class DuplicateIdempotencyKeyError extends DomainError {
  constructor() {
    super('conflict', 'DUPLICATE_IDEMPOTENCY_KEY', 'A request with this Idempotency-Key already exists');
  }
}
