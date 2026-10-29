import { Email } from '../../src/domain/email';
import { InvalidEmailError, WeakPasswordError } from '../../src/domain/errors';
import { assertAcceptablePassword } from '../../src/domain/password-policy';
import { RefreshToken } from '../../src/domain/refresh-token';

describe('Email', () => {
  it('trims and lower-cases', () => {
    expect(Email.parse('  Anna@Example.COM ').value).toBe('anna@example.com');
  });

  it('rejects text that is not an email', () => {
    expect(() => Email.parse('not-an-email')).toThrow(InvalidEmailError);
    expect(() => Email.parse('a@b')).toThrow(InvalidEmailError);
  });
});

describe('password policy', () => {
  it('accepts 8 characters', () => {
    expect(() => assertAcceptablePassword('12345678')).not.toThrow();
  });

  it('rejects short passwords', () => {
    expect(() => assertAcceptablePassword('1234567')).toThrow(WeakPasswordError);
  });

  it('rejects passwords over 72 bytes, the bcrypt limit', () => {
    expect(() => assertAcceptablePassword('a'.repeat(73))).toThrow(WeakPasswordError);
  });
});

describe('RefreshToken', () => {
  const now = new Date('2026-01-01T00:00:00Z');
  const token = RefreshToken.issue({ id: 't1', userId: 'u1', familyId: 'f1', tokenHash: 'h', now, ttlMs: 1000 });

  it('is valid until it expires', () => {
    expect(token.isExpired(new Date(now.getTime() + 999))).toBe(false);
    expect(token.isExpired(new Date(now.getTime() + 1000))).toBe(true);
  });

  it('starts as not revoked', () => {
    expect(token.isRevoked()).toBe(false);
  });
});
