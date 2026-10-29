import { WeakPasswordError } from './errors';

/** bcrypt only looks at the first 72 bytes, so longer passwords are refused. */
export function assertAcceptablePassword(password: string): void {
  if (password.length < 8) {
    throw new WeakPasswordError('Password must have at least 8 characters');
  }
  if (Buffer.byteLength(password, 'utf8') > 72) {
    throw new WeakPasswordError('Password must be at most 72 bytes long');
  }
}
