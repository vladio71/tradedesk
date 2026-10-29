import { Controller, Get, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser, mapPage, Page } from '@tradedesk/common';
import { GetMyWalletUseCase } from '../../application/get-my-wallet.use-case';
import { ListLedgerUseCase } from '../../application/list-ledger.use-case';
import { LedgerEntryResponseDto, LedgerQueryDto, WalletResponseDto } from './dto/wallet.dto';
import { toLedgerEntryResponse, toWalletResponse } from './mappers/wallet.mapper';

@ApiTags('wallets')
@ApiCookieAuth()
@Controller('wallets')
export class WalletsController {
  constructor(
    private readonly getMyWallet: GetMyWalletUseCase,
    private readonly listLedger: ListLedgerUseCase,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'My wallet. Created on first call' })
  async me(@CurrentUser() user: AuthUser): Promise<WalletResponseDto> {
    return toWalletResponse(await this.getMyWallet.execute(user.id));
  }

  @Get('me/ledger')
  @ApiOperation({ summary: 'My ledger entries, newest first' })
  async ledger(@CurrentUser() user: AuthUser, @Query() query: LedgerQueryDto): Promise<Page<LedgerEntryResponseDto>> {
    const page = await this.listLedger.execute({
      userId: user.id,
      page: query.page,
      pageSize: query.pageSize,
      kind: query.kind,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
    });
    return mapPage(page, toLedgerEntryResponse);
  }
}
