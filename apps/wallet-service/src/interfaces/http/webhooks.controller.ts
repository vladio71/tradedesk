import { Body, Controller, Headers, HttpCode, Post, RawBodyRequest, Req } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public, SkipCsrf } from '@tradedesk/common';
import { Request } from 'express';
import { HandleCryptoWebhookUseCase, WebhookOutcome } from '../../application/handle-crypto-webhook.use-case';
import { CryptoWebhookDto } from './dto/deposit.dto';

@ApiTags('webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly handleWebhook: HandleCryptoWebhookUseCase) {}

  /** Called by the crypto provider, not by a browser: no cookie, no CSRF. The HMAC signature is the authentication. */
  @Public()
  @SkipCsrf()
  @Post('crypto')
  @HttpCode(200)
  @ApiOperation({ summary: 'Crypto provider webhook. Signed with HMAC-SHA256' })
  @ApiHeader({ name: 'X-Signature', required: true, description: 'hex(HMAC-SHA256(secret, raw body))' })
  async crypto(
    @Req() request: RawBodyRequest<Request>,
    @Headers('x-signature') signature: string | undefined,
    @Body() event: CryptoWebhookDto,
  ): Promise<{ status: WebhookOutcome }> {
    const status = await this.handleWebhook.execute({ rawBody: request.rawBody ?? Buffer.alloc(0), signature, event });
    return { status };
  }
}
