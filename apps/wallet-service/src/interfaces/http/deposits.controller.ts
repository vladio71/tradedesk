import { Body, Controller, Get, Headers, Param, ParseUUIDPipe, Post, Query, Res } from '@nestjs/common';
import { ApiCookieAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser, mapPage, Page, PageQueryDto, requireIdempotencyKey } from '@tradedesk/common';
import { Response } from 'express';
import { GetDepositUseCase, ListDepositsUseCase } from '../../application/list-deposits.use-case';
import { RequestDepositUseCase } from '../../application/request-deposit.use-case';
import { CreateDepositDto, DepositResponseDto } from './dto/deposit.dto';
import { toDepositResponse } from './mappers/wallet.mapper';

@ApiTags('deposits')
@ApiCookieAuth()
@Controller('deposits')
export class DepositsController {
  constructor(
    private readonly requestDeposit: RequestDepositUseCase,
    private readonly listDeposits: ListDepositsUseCase,
    private readonly getDeposit: GetDepositUseCase,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Request a crypto deposit. Returns a deposit address' })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async create(
    @CurrentUser() user: AuthUser,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() dto: CreateDepositDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<DepositResponseDto> {
    const result = await this.requestDeposit.execute({
      userId: user.id,
      idempotencyKey: requireIdempotencyKey(idempotencyKey),
      asset: dto.asset,
      amount: dto.amount,
    });
    if (result.replayed) {
      response.status(200).setHeader('Idempotent-Replayed', 'true');
    }
    return toDepositResponse(result.deposit);
  }

  @Get()
  @ApiOperation({ summary: 'My deposits' })
  async list(@CurrentUser() user: AuthUser, @Query() query: PageQueryDto): Promise<Page<DepositResponseDto>> {
    return mapPage(await this.listDeposits.execute(user.id, query), toDepositResponse);
  }

  @Get(':id')
  @ApiOperation({ summary: 'One of my deposits' })
  async get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<DepositResponseDto> {
    return toDepositResponse(await this.getDeposit.execute(user.id, id));
  }
}
