import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'price_ticks' })
export class PriceTickOrmEntity {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: string;

  @Column({ name: 'asset_id', type: 'uuid' })
  assetId: string;

  @Column({ type: 'numeric', precision: 20, scale: 8 })
  price: string;

  @Column({ type: 'timestamptz' })
  ts: Date;
}
