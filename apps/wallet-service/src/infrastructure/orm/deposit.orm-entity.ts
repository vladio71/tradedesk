import { Column, Entity, PrimaryColumn } from 'typeorm';
import { CryptoAsset, DepositStatus } from '../../domain/deposit';

@Entity({ name: 'deposits' })
export class DepositOrmEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'wallet_id', type: 'uuid' })
  walletId: string;

  @Column({ type: 'varchar', length: 10 })
  asset: CryptoAsset;

  @Column({ type: 'numeric', precision: 20, scale: 8 })
  amount: string;

  @Column({ name: 'usd_rate', type: 'numeric', precision: 20, scale: 8 })
  usdRate: string;

  @Column({ name: 'credit_amount', type: 'numeric', precision: 20, scale: 8 })
  creditAmount: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  address: string;

  @Column({ name: 'tx_hash', type: 'varchar', length: 100, nullable: true })
  txHash: string | null;

  @Column({ type: 'varchar', length: 10 })
  status: DepositStatus;

  @Column({ name: 'idempotency_key', type: 'varchar', length: 128 })
  idempotencyKey: string;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'confirmed_at', type: 'timestamptz', nullable: true })
  confirmedAt: Date | null;
}
