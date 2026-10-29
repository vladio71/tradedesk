export type DomainErrorKind = 'not_found' | 'conflict' | 'validation' | 'unauthorized' | 'forbidden';

/**
 * Base class for errors raised by domain and application code.
 * It has no HTTP knowledge. The exception filter maps `kind` to a status code.
 */
export class DomainError extends Error {
  constructor(
    public readonly kind: DomainErrorKind,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}
