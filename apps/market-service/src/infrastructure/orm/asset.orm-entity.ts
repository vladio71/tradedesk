import { Column, Entity, PrimaryColumn } from 'typeorm';
import { AssetCategory, AssetStatus } from '../../domain/asset';

@Entity({ name: 'assets' })
export class AssetOrmEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20, unique: true })
  symbol: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 20 })
  category: AssetCategory;

  @Column({ type: 'varchar', length: 10 })
  status: AssetStatus;

  @Column({ name: 'last_price', type: 'numeric', precision: 20, scale: 8 })
  lastPrice: string;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
