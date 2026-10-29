import { DomainError } from '@tradedesk/common';

export class InvalidEmailError extends DomainError {
  constructor(value: string) {
    super('validation', 'INVALID_EMAIL', `"${value}" is not a valid email address`);
  }
}

export class WeakPasswordError extends DomainError {
  constructor(reason: string) {
    super('validation', 'WEAK_PASSWORD', reason);
  }
}

export class EmailAlreadyUsedError extends DomainError {
  constructor() {
    super('conflict', 'EMAIL_ALREADY_USED', 'A user with this email already exists');
  }
}

export class InvalidCredentialsError extends DomainError {
  constructor() {
    super('unauthorized', 'INVALID_CREDENTIALS', 'Invalid email or password');
  }
}

export class InvalidRefreshTokenError extends DomainError {
  constructor() {
    super('unauthorized', 'INVALID_REFRESH_TOKEN', 'Refresh token is invalid or expired');
  }
}

export class RefreshTokenReuseError extends DomainError {
  constructor() {
    super('unauthorized', 'REFRESH_TOKEN_REUSE', 'Refresh token was already used. All sessions of this login were revoked');
  }
}

export class UserNotFoundError extends DomainError {
  constructor() {
    super('not_found', 'USER_NOT_FOUND', 'User not found');
  }
}
