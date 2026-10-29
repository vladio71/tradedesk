import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PageQueryDto } from '@tradedesk/common';
import { IsIn, IsOptional, IsString, Matches } from 'class-validator';
import { POSITION_SIDES, POSITION_STATUSES, PositionSide, PositionStatus } from '../../../domain/position';
import { DECIMAL_PATTERN, SYMBOL_PATTERN } from './asset.dto';

export class OpenPositionDto {
  @ApiProperty({ example: 'BTC' })
  @IsString()
  @Matches(SYMBOL_PATTERN)
  symbol: string;

  @ApiProperty({ enum: POSITION_SIDES })
  @IsIn(POSITION_SIDES)
  side: PositionSide;

  @ApiProperty({ example: '0.5', description: 'Decimal string' })
  @IsString()
  @Matches(DECIMAL_PATTERN)
  quantity: string;
}

export class PositionListQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: POSITION_STATUSES })
  @IsOptional()
  @IsIn(POSITION_STATUSES)
  status?: PositionStatus;

  @ApiPropertyOptional({ enum: POSITION_SIDES })
  @IsOptional()
  @IsIn(POSITION_SIDES)
  side?: PositionSide;

  @ApiPropertyOptional({ example: 'BTC' })
  @IsOptional()
  @IsString()
  @Matches(SYMBOL_PATTERN)
  symbol?: string;
}

export class PositionResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() symbol: string;
  @ApiProperty({ enum: POSITION_SIDES }) side: PositionSide;
  @ApiProperty() quantity: string;
  @ApiProperty() entryPrice: string;
  @ApiProperty({ enum: POSITION_STATUSES }) status: PositionStatus;
  @ApiProperty({ nullable: true, type: String }) closedPrice: string | null;
  @ApiProperty({ nullable: true, type: String }) pnl: string | null;
  @ApiProperty() openedAt: string;
  @ApiProperty({ nullable: true, type: String }) closedAt: string | null;
}

export class PnlSummaryResponseDto {
  @ApiProperty() symbol: string;
  @ApiProperty() openCount: number;
  @ApiProperty() closedCount: number;
  @ApiProperty() openQuantity: string;
  @ApiProperty() realizedPnl: string;
  @ApiProperty() unrealizedPnl: string;
}
