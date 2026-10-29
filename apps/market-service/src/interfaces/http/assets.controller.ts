import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { mapPage, Page, Roles } from '@tradedesk/common';
import { BulkDeleteAssetsUseCase, BulkSetAssetStatusUseCase, BulkUpsertAssetsUseCase } from '../../application/bulk-assets.use-cases';
import { CreateAssetUseCase } from '../../application/create-asset.use-case';
import { GetCandlesUseCase } from '../../application/get-candles.use-case';
import { GetAssetUseCase, SearchAssetsUseCase } from '../../application/search-assets.use-case';
import { UpdateAssetUseCase } from '../../application/update-asset.use-case';
import {
  AssetListQueryDto,
  AssetResponseDto,
  BulkDeleteDto,
  BulkStatusDto,
  BulkUpsertAssetsDto,
  CandleResponseDto,
  CandlesQueryDto,
  CreateAssetDto,
  UpdateAssetDto,
} from './dto/asset.dto';
import { toAssetResponse } from './mappers/market.mapper';

@ApiTags('assets')
@ApiCookieAuth()
@Controller('assets')
export class AssetsController {
  constructor(
    private readonly searchAssets: SearchAssetsUseCase,
    private readonly getAsset: GetAssetUseCase,
    private readonly createAsset: CreateAssetUseCase,
    private readonly updateAsset: UpdateAssetUseCase,
    private readonly bulkUpsert: BulkUpsertAssetsUseCase,
    private readonly bulkSetStatus: BulkSetAssetStatusUseCase,
    private readonly bulkDelete: BulkDeleteAssetsUseCase,
    private readonly getCandles: GetCandlesUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Search assets with filters, sorting and pagination' })
  async list(@Query() query: AssetListQueryDto): Promise<Page<AssetResponseDto>> {
    return mapPage(await this.searchAssets.execute(query), toAssetResponse);
  }

  @Get(':symbol')
  @ApiOperation({ summary: 'One asset by symbol' })
  async get(@Param('symbol') symbol: string): Promise<AssetResponseDto> {
    return toAssetResponse(await this.getAsset.execute(symbol));
  }

  @Get(':symbol/candles')
  @ApiOperation({ summary: 'OHLC candles built from stored ticks' })
  async candles(@Param('symbol') symbol: string, @Query() query: CandlesQueryDto): Promise<CandleResponseDto[]> {
    return this.getCandles.execute({
      symbol,
      interval: query.interval,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      limit: query.limit,
    });
  }

  @Post()
  @Roles('admin')
  @ApiOperation({ summary: 'Create an asset (admin)' })
  async create(@Body() dto: CreateAssetDto): Promise<AssetResponseDto> {
    return toAssetResponse(await this.createAsset.execute(dto));
  }

  @Post('bulk')
  @Roles('admin')
  @HttpCode(200)
  @ApiOperation({ summary: 'Upsert many assets by symbol in one transaction (admin)' })
  bulk(@Body() dto: BulkUpsertAssetsDto): Promise<{ created: number; updated: number }> {
    return this.bulkUpsert.execute(dto.assets);
  }

  @Post('bulk/status')
  @Roles('admin')
  @HttpCode(200)
  @ApiOperation({ summary: 'Set the status of many assets. All or nothing (admin)' })
  bulkStatus(@Body() dto: BulkStatusDto): Promise<{ affected: number }> {
    return this.bulkSetStatus.execute(dto.ids, dto.status);
  }

  @Delete('bulk')
  @Roles('admin')
  @ApiOperation({ summary: 'Soft delete many assets (admin)' })
  bulkRemove(@Body() dto: BulkDeleteDto): Promise<{ affected: number }> {
    return this.bulkDelete.execute(dto.ids);
  }

  @Patch(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Update an asset (admin)' })
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAssetDto): Promise<AssetResponseDto> {
    return toAssetResponse(await this.updateAsset.execute({ id, ...dto }));
  }
}
