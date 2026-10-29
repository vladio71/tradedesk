import { randomBytes } from 'node:crypto';
import { CryptoAsset } from '../domain/deposit';
import { CryptoProvider } from '../domain/ports';

const USD_RATES: Record<CryptoAsset, string> = {
  BTC: '60000',
  ETH: '3000',
  USDT: '1',
};

/** Stand-in for a real custody provider. It makes up addresses and uses fixed prices. */
export class FakeCryptoProvider implements CryptoProvider {
  async createDepositAddress(asset: CryptoAsset): Promise<string> {
    if (asset === 'BTC') {
      return `bc1q${randomBytes(20).toString('hex')}`;
    }
    return `0x${randomBytes(20).toString('hex')}`;
  }

  async getUsdRate(asset: CryptoAsset): Promise<string> {
    return USD_RATES[asset];
  }
}
