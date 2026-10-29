import { Column, Entity, PrimaryColumn } from 'typeorm';
import { PositionSide, PositionStatus } from '../../domain/position';

@Entity({ name: 'positions' })
export class PositionOrmEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'asset_id', type: 'uuid' })
  assetId: string;

  @Column({ type: 'varchar', length: 20 })
  symbol: string;

  @Column({ type: 'varchar', length: 5 })
  side: PositionSide;

  @Column({ type: 'numeric', precision: 20, scale: 8 })
  quantity: string;

  @Column({ name: 'entry_price', type: 'numeric', precision: 20, scale: 8 })
  entryPrice: string;

  @Column({ type: 'varchar', length: 6 })
  status: PositionStatus;

  @Column({ name: 'closed_price', type: 'numeric', precision: 20, scale: 8, nullable: true })
  closedPrice: string | null;

  @Column({ type: 'numeric', precision: 20, scale: 8, nullable: true })
  pnl: string | null;

  @Column({ name: 'opened_at', type: 'timestamptz' })
  openedAt: Date;

  @Column({ name: 'closed_at', type: 'timestamptz', nullable: true })
  closedAt: Date | null;
}
