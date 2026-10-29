import { CryptoAsset } from './deposit';

export const CRYPTO_PROVIDER = Symbol('CRYPTO_PROVIDER');
export const WEBHOOK_SIGNER = Symbol('WEBHOOK_SIGNER');
export const WEBHOOK_DELIVERY = Symbol('WEBHOOK_DELIVERY');

/** The outside world that owns deposit addresses and prices. Replace the fake with a real provider later. */
export interface CryptoProvider {
  createDepositAddress(asset: CryptoAsset): Promise<string>;
  /** USD price of one unit, as a decimal string. */
  getUsdRate(asset: CryptoAsset): Promise<string>;
}

export interface WebhookSigner {
  sign(rawBody: string | Buffer): string;
  verify(rawBody: string | Buffer, signature: string): boolean;
}

export interface WebhookDelivery {
  deliver(url: string, rawBody: string, signature: string): Promise<{ status: number; body: unknown }>;
}

/** Body of the webhook sent by the crypto provider. */
export interface CryptoWebhookEvent {
  eventId: string;
  type: 'deposit.confirmed';
  address: string;
  asset: CryptoAsset;
  amount: string;
  txHash: string;
}
