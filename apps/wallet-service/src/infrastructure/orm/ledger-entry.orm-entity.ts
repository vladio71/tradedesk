import { Column, Entity, PrimaryColumn } from 'typeorm';
import { LedgerDirection, LedgerKind } from '../../domain/ledger-entry';

@Entity({ name: 'ledger_entries' })
export class LedgerEntryOrmEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'wallet_id', type: 'uuid' })
  walletId: string;

  @Column({ type: 'varchar', length: 20 })
  kind: LedgerKind;

  @Column({ type: 'varchar', length: 6 })
  direction: LedgerDirection;

  @Column({ type: 'numeric', precision: 20, scale: 8 })
  amount: string;

  @Column({ name: 'balance_after', type: 'numeric', precision: 20, scale: 8 })
  balanceAfter: string;

  @Column({ name: 'reference_id', type: 'uuid' })
  referenceId: string;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
