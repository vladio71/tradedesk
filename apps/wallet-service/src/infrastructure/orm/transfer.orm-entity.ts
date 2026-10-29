import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'transfers' })
export class TransferOrmEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'from_user_id', type: 'uuid' })
  fromUserId: string;

  @Column({ name: 'to_user_id', type: 'uuid' })
  toUserId: string;

  @Column({ name: 'from_wallet_id', type: 'uuid' })
  fromWalletId: string;

  @Column({ name: 'to_wallet_id', type: 'uuid' })
  toWalletId: string;

  @Column({ type: 'numeric', precision: 20, scale: 8 })
  amount: string;

  @Column({ type: 'varchar', length: 10 })
  status: 'completed';

  @Column({ type: 'varchar', length: 200, nullable: true })
  note: string | null;

  @Column({ name: 'idempotency_key', type: 'varchar', length: 128 })
  idempotencyKey: string;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
