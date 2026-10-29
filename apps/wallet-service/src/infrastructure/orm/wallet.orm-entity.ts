import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'wallets' })
export class WalletOrmEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid', unique: true })
  userId: string;

  @Column({ type: 'numeric', precision: 20, scale: 8 })
  balance: string;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
