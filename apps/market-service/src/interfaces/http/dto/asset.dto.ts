import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PageQueryDto } from '@tradedesk/common';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ASSET_CATEGORIES, ASSET_STATUSES, AssetCategory, AssetStatus } from '../../../domain/asset';
import { AssetSortField } from '../../../domain/asset.repository';
import { CANDLE_INTERVALS, CandleInterval } from '../../../domain/tick';

export const SYMBOL_PATTERN = /^[A-Za-z0-9._-]{1,20}$/;
export const DECIMAL_PATTERN = /^\d{1,12}(\.\d{1,8})?$/;
export const MAX_BULK_SIZE = 500;
const SORT_FIELDS: AssetSortField[] = ['symbol', 'name', 'lastPrice', 'updatedAt'];

export class AssetListQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ description: 'Search in symbol and name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ enum: ASSET_CATEGORIES })
  @IsOptional()
  @IsIn(ASSET_CATEGORIES)
  category?: AssetCategory;

  @ApiPropertyOptional({ enum: ASSET_STATUSES })
  @IsOptional()
  @IsIn(ASSET_STATUSES)
  status?: AssetStatus;

  @ApiPropertyOptional({ example: '10' })
  @IsOptional()
  @Matches(DECIMAL_PATTERN)
  minPrice?: string;

  @ApiPropertyOptional({ example: '1000' })
  @IsOptional()
  @Matches(DECIMAL_PATTERN)
  maxPrice?: string;

  @ApiPropertyOptional({ enum: SORT_FIELDS, default: 'symbol' })
  @IsOptional()
  @IsIn(SORT_FIELDS)
  sort: AssetSortField = 'symbol';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'asc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order: 'asc' | 'desc' = 'asc';
}

export class CreateAssetDto {
  @ApiProperty({ example: 'BTC' })
  @IsString()
  @Matches(SYMBOL_PATTERN)
  symbol: string;

  @ApiProperty({ example: 'Bitcoin' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @ApiProperty({ enum: ASSET_CATEGORIES })
  @IsIn(ASSET_CATEGORIES)
  category: AssetCategory;

  @ApiPropertyOptional({ enum: ASSET_STATUSES, default: 'active' })
  @IsOptional()
  @IsIn(ASSET_STATUSES)
  status?: AssetStatus;

  @ApiProperty({ example: '60000.5', description: 'Decimal string' })
  @IsString()
  @Matches(DECIMAL_PATTERN)
  lastPrice: string;
}

export class UpdateAssetDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ enum: ASSET_CATEGORIES })
  @IsOptional()
  @IsIn(ASSET_CATEGORIES)
  category?: AssetCategory;

  @ApiPropertyOptional({ enum: ASSET_STATUSES })
  @IsOptional()
  @IsIn(ASSET_STATUSES)
  status?: AssetStatus;
}

export class BulkUpsertAssetsDto {
  @ApiProperty({ type: [CreateAssetDto], description: `1 to ${MAX_BULK_SIZE} assets` })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_BULK_SIZE)
  @ValidateNested({ each: true })
  @Type(() => CreateAssetDto)
  assets: CreateAssetDto[];
}

export class BulkStatusDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_BULK_SIZE)
  @IsUUID('all', { each: true })
  ids: string[];

  @ApiProperty({ enum: ASSET_STATUSES })
  @IsIn(ASSET_STATUSES)
  status: AssetStatus;
}

export class BulkDeleteDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_BULK_SIZE)
  @IsUUID('all', { each: true })
  ids: string[];
}

export class CandlesQueryDto {
  @ApiProperty({ enum: CANDLE_INTERVALS })
  @IsIn(CANDLE_INTERVALS)
  interval: CandleInterval;

  @ApiPropertyOptional({ description: 'ISO date, inclusive. Default: 24 hours before "to"' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'ISO date, exclusive. Default: now' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ default: 200, maximum: 1000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  limit: number = 200;
}

export class AssetResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() symbol: string;
  @ApiProperty() name: string;
  @ApiProperty({ enum: ASSET_CATEGORIES }) category: AssetCategory;
  @ApiProperty({ enum: ASSET_STATUSES }) status: AssetStatus;
  @ApiProperty() lastPrice: string;
  @ApiProperty() updatedAt: string;
}

export class CandleResponseDto {
  @ApiProperty() bucket: string;
  @ApiProperty() open: string;
  @ApiProperty() high: string;
  @ApiProperty() low: string;
  @ApiProperty() close: string;
  @ApiProperty() ticks: number;
}
