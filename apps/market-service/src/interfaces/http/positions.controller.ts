import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser, mapPage, Page } from '@tradedesk/common';
import { ClosePositionUseCase } from '../../application/close-position.use-case';
import { GetPositionSummaryUseCase, ListPositionsUseCase } from '../../application/list-positions.use-case';
import { OpenPositionUseCase } from '../../application/open-position.use-case';
import { Asset } from '../../domain/asset';
import { OpenPositionDto, PnlSummaryResponseDto, PositionListQueryDto, PositionResponseDto } from './dto/position.dto';
import { toPositionResponse } from './mappers/market.mapper';

@ApiTags('positions')
@ApiCookieAuth()
@Controller('positions')
export class PositionsController {
  constructor(
    private readonly openPosition: OpenPositionUseCase,
    private readonly closePosition: ClosePositionUseCase,
    private readonly listPositions: ListPositionsUseCase,
    private readonly positionSummary: GetPositionSummaryUseCase,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Open a position at the current price. Active assets only' })
  async open(@CurrentUser() user: AuthUser, @Body() dto: OpenPositionDto): Promise<PositionResponseDto> {
    return toPositionResponse(await this.openPosition.execute({ userId: user.id, ...dto }));
  }

  @Get('summary')
  @ApiOperation({ summary: 'Realized and unrealized pnl per asset' })
  summary(@CurrentUser() user: AuthUser): Promise<PnlSummaryResponseDto[]> {
    return this.positionSummary.execute(user.id);
  }

  @Get()
  @ApiOperation({ summary: 'My positions' })
  async list(@CurrentUser() user: AuthUser, @Query() query: PositionListQueryDto): Promise<Page<PositionResponseDto>> {
    const page = await this.listPositions.execute({
      userId: user.id,
      page: query.page,
      pageSize: query.pageSize,
      status: query.status,
      side: query.side,
      symbol: query.symbol ? Asset.normalizeSymbol(query.symbol) : undefined,
    });
    return mapPage(page, toPositionResponse);
  }

  @Post(':id/close')
  @ApiOperation({ summary: 'Close a position at the current price and compute pnl' })
  async close(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<PositionResponseDto> {
    return toPositionResponse(await this.closePosition.execute(user.id, id));
  }
}
