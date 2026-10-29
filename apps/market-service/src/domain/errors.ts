import { DomainError } from '@tradedesk/common';

export class InvalidDecimalError extends DomainError {
  constructor(reason: string) {
    super('validation', 'INVALID_DECIMAL', reason);
  }
}

export class AssetNotFoundError extends DomainError {
  constructor(what: string) {
    super('not_found', 'ASSET_NOT_FOUND', `Asset ${what} not found`);
  }
}

export class SymbolAlreadyExistsError extends DomainError {
  constructor(symbol: string) {
    super('conflict', 'SYMBOL_ALREADY_EXISTS', `Asset ${symbol} already exists`);
  }
}

export class AssetNotTradableError extends DomainError {
  constructor(symbol: string) {
    super('conflict', 'ASSET_NOT_TRADABLE', `Asset ${symbol} is not active, so it cannot be traded`);
  }
}

export class PositionNotFoundError extends DomainError {
  constructor() {
    super('not_found', 'POSITION_NOT_FOUND', 'Position not found');
  }
}

export class PositionAlreadyClosedError extends DomainError {
  constructor() {
    super('conflict', 'POSITION_ALREADY_CLOSED', 'Position is already closed');
  }
}

export class DuplicateSymbolsInBatchError extends DomainError {
  constructor(symbols: string[]) {
    super('validation', 'DUPLICATE_SYMBOLS_IN_BATCH', `Symbols appear more than once in the batch: ${symbols.join(', ')}`);
  }
}

/** All-or-nothing bulk operations fail with this when some ids do not exist. */
export class AssetsMissingError extends DomainError {
  constructor(public readonly missingIds: string[]) {
    super('not_found', 'ASSETS_MISSING', `These asset ids do not exist: ${missingIds.join(', ')}. Nothing was changed`);
  }
}
