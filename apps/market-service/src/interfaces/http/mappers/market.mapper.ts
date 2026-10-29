import { Asset } from '../../../domain/asset';
import { Position } from '../../../domain/position';
import { AssetResponseDto } from '../dto/asset.dto';
import { PositionResponseDto } from '../dto/position.dto';

export function toAssetResponse(asset: Asset): AssetResponseDto {
  return {
    id: asset.id,
    symbol: asset.symbol,
    name: asset.name,
    category: asset.category,
    status: asset.status,
    lastPrice: asset.lastPrice.toString(),
    updatedAt: asset.updatedAt.toISOString(),
  };
}

export function toPositionResponse(position: Position): PositionResponseDto {
  return {
    id: position.id,
    symbol: position.symbol,
    side: position.side,
    quantity: position.quantity.toString(),
    entryPrice: position.entryPrice.toString(),
    status: position.status,
    closedPrice: position.closedPrice ? position.closedPrice.toString() : null,
    pnl: position.pnl ? position.pnl.toString() : null,
    openedAt: position.openedAt.toISOString(),
    closedAt: position.closedAt ? position.closedAt.toISOString() : null,
  };
}
