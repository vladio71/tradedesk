import { createHmac, timingSafeEqual } from 'node:crypto';
import { WebhookSigner } from '../domain/ports';

/** Signature = hex(HMAC-SHA256(secret, raw body)). */
export class HmacWebhookSigner implements WebhookSigner {
  constructor(private readonly secret: string) {}

  sign(rawBody: string | Buffer): string {
    return createHmac('sha256', this.secret).update(rawBody).digest('hex');
  }

  verify(rawBody: string | Buffer, signature: string): boolean {
    const expected = Buffer.from(this.sign(rawBody), 'hex');
    const given = Buffer.from(signature, 'hex');
    // timingSafeEqual throws on different lengths, so check the length first.
    return given.length === expected.length && timingSafeEqual(given, expected);
  }
}
