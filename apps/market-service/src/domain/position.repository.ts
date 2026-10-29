import { Page, PageRequest } from '@tradedesk/common';
import { Position, PositionSide, PositionStatus } from './position';

export const POSITION_REPOSITORY = Symbol('POSITION_REPOSITORY');

export interface PositionFilter extends PageRequest {
  userId: string;
  status?: PositionStatus;
  side?: PositionSide;
  symbol?: string;
}

export interface PnlSummaryRow {
  symbol: string;
  openCount: number;
  closedCount: number;
  openQuantity: string;
  realizedPnl: string;
  unrealizedPnl: string;
}

export interface PositionRepository {
  insert(position: Position): Promise<void>;
  /** Locks the row (SELECT ... FOR UPDATE) so a position cannot be closed twice at the same time. */
  findByIdForUpdate(id: string, userId: string): Promise<Position | null>;
  save(position: Position): Promise<void>;
  list(filter: PositionFilter): Promise<Page<Position>>;
  summary(userId: string): Promise<PnlSummaryRow[]>;
}
