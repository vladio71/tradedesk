import { Body, Controller, Get, Headers, Param, ParseUUIDPipe, Post, Query, Res } from '@nestjs/common';
import { ApiCookieAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser, mapPage, Page, PageQueryDto, requireIdempotencyKey } from '@tradedesk/common';
import { Response } from 'express';
import { CreateTransferUseCase } from '../../application/create-transfer.use-case';
import { GetTransferUseCase, ListTransfersUseCase } from '../../application/list-transfers.use-case';
import { CreateTransferDto, TransferResponseDto } from './dto/transfer.dto';
import { toTransferResponse } from './mappers/wallet.mapper';

@ApiTags('transfers')
@ApiCookieAuth()
@Controller('transfers')
export class TransfersController {
  constructor(
    private readonly createTransfer: CreateTransferUseCase,
    private readonly listTransfers: ListTransfersUseCase,
    private readonly getTransfer: GetTransferUseCase,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Send money to another user. Atomic and idempotent' })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async create(
    @CurrentUser() user: AuthUser,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() dto: CreateTransferDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<TransferResponseDto> {
    const result = await this.createTransfer.execute({
      senderUserId: user.id,
      recipientUserId: dto.recipientUserId,
      amount: dto.amount,
      note: dto.note,
      idempotencyKey: requireIdempotencyKey(idempotencyKey),
    });
    if (result.replayed) {
      response.status(200).setHeader('Idempotent-Replayed', 'true');
    }
    return toTransferResponse(result.transfer, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'My transfers (sent and received)' })
  async list(@CurrentUser() user: AuthUser, @Query() query: PageQueryDto): Promise<Page<TransferResponseDto>> {
    const page = await this.listTransfers.execute(user.id, query);
    return mapPage(page, (transfer) => toTransferResponse(transfer, user.id));
  }

  @Get(':id')
  @ApiOperation({ summary: 'One of my transfers' })
  async get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<TransferResponseDto> {
    return toTransferResponse(await this.getTransfer.execute(user.id, id), user.id);
  }
}
