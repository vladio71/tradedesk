import { Asset } from './asset';
import { Decimal8 } from './decimal8';
import { AssetNotTradableError, PositionAlreadyClosedError } from './errors';

export type PositionSide = 'long' | 'short';
export type PositionStatus = 'open' | 'closed';

export const POSITION_SIDES: PositionSide[] = ['long', 'short'];
export const POSITION_STATUSES: PositionStatus[] = ['open', 'closed'];

export interface PositionProps {
  id: string;
  userId: string;
  assetId: string;
  symbol: string;
  side: PositionSide;
  quantity: Decimal8;
  entryPrice: Decimal8;
  status: PositionStatus;
  closedPrice: Decimal8 | null;
  pnl: Decimal8 | null;
  openedAt: Date;
  closedAt: Date | null;
}

export class Position {
  readonly id: string;
  readonly userId: string;
  readonly assetId: string;
  readonly symbol: string;
  readonly side: PositionSide;
  readonly quantity: Decimal8;
  readonly entryPrice: Decimal8;
  readonly openedAt: Date;
  status: PositionStatus;
  closedPrice: Decimal8 | null;
  pnl: Decimal8 | null;
  closedAt: Date | null;

  constructor(props: PositionProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.assetId = props.assetId;
    this.symbol = props.symbol;
    this.side = props.side;
    this.quantity = props.quantity;
    this.entryPrice = props.entryPrice;
    this.status = props.status;
    this.closedPrice = props.closedPrice;
    this.pnl = props.pnl;
    this.openedAt = props.openedAt;
    this.closedAt = props.closedAt;
  }

  /** Opens at the current price of the asset. Only active assets can be traded. */
  static open(input: { id: string; userId: string; asset: Asset; side: PositionSide; quantity: string; now: Date }): Position {
    if (!input.asset.isTradable()) {
      throw new AssetNotTradableError(input.asset.symbol);
    }
    return new Position({
      id: input.id,
      userId: input.userId,
      assetId: input.asset.id,
      symbol: input.asset.symbol,
      side: input.side,
      quantity: Decimal8.positive(input.quantity),
      entryPrice: input.asset.lastPrice,
      status: 'open',
      closedPrice: null,
      pnl: null,
      openedAt: input.now,
      closedAt: null,
    });
  }

  /** Profit or loss if the position were closed at `price`. Long gains when the price rises, short when it falls. */
  pnlAt(price: Decimal8): Decimal8 {
    const move = this.side === 'long' ? price.minus(this.entryPrice) : this.entryPrice.minus(price);
    return move.times(this.quantity);
  }

  close(price: Decimal8, now: Date): void {
    if (this.status === 'closed') {
      throw new PositionAlreadyClosedError();
    }
    this.pnl = this.pnlAt(price);
    this.closedPrice = price;
    this.status = 'closed';
    this.closedAt = now;
  }
}
