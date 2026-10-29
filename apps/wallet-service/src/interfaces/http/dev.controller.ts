import { Body, Controller, Post, Req } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '@tradedesk/common';
import { Request } from 'express';
import { SimulateDepositUseCase } from '../../application/simulate-deposit.use-case';
import { SimulateDepositDto } from './dto/deposit.dto';

/** Only registered when NODE_ENV is not production. See WalletModule. */
@ApiTags('dev')
@ApiCookieAuth()
@Controller('dev')
export class DevController {
  constructor(private readonly simulateDeposit: SimulateDepositUseCase) {}

  @Post('simulate-deposit')
  @ApiOperation({ summary: 'Dev only: sign a webhook for a pending deposit and deliver it to this service' })
  async simulate(
    @CurrentUser() user: AuthUser,
    @Body() dto: SimulateDepositDto,
    @Req() request: Request,
  ): Promise<{ webhookStatus: number; webhookResponse: unknown }> {
    // The local port of the socket that received this request is this server's own port.
    const webhookUrl = `http://127.0.0.1:${request.socket.localPort}/api/wallet/webhooks/crypto`;
    const result = await this.simulateDeposit.execute({ userId: user.id, depositId: dto.depositId, webhookUrl });
    return { webhookStatus: result.status, webhookResponse: result.body };
  }
}
