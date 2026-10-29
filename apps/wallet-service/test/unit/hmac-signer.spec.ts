import { HmacWebhookSigner } from '../../src/infrastructure/hmac-webhook-signer';

describe('HmacWebhookSigner', () => {
  const signer = new HmacWebhookSigner('test-secret');

  it('accepts its own signature', () => {
    const body = '{"a":1}';
    expect(signer.verify(body, signer.sign(body))).toBe(true);
  });

  it('rejects a changed body, another secret, wrong length and non-hex input', () => {
    const body = '{"a":1}';
    const signature = signer.sign(body);
    expect(signer.verify('{"a":2}', signature)).toBe(false);
    expect(new HmacWebhookSigner('other').verify(body, signature)).toBe(false);
    expect(signer.verify(body, signature.slice(2))).toBe(false);
    expect(signer.verify(body, 'zzzz')).toBe(false);
    expect(signer.verify(body, '')).toBe(false);
  });
});
