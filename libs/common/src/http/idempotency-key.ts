import { BadRequestException } from '@nestjs/common';

/** Reads and validates the Idempotency-Key header value. */
export function requireIdempotencyKey(value: string | undefined): string {
  if (!value || value.trim().length === 0) {
    throw new BadRequestException('Idempotency-Key header is required');
  }
  const key = value.trim();
  if (key.length < 8 || key.length > 128) {
    throw new BadRequestException('Idempotency-Key must be 8 to 128 characters');
  }
  return key;
}
