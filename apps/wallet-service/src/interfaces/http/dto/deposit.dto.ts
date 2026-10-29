import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, Matches } from 'class-validator';
import { CRYPTO_ASSETS, CryptoAsset } from '../../../domain/deposit';

export const DECIMAL_PATTERN = /^\d{1,12}(\.\d{1,8})?$/;

export class CreateDepositDto {
  @ApiProperty({ enum: CRYPTO_ASSETS })
  @IsIn(CRYPTO_ASSETS)
  asset: CryptoAsset;

  @ApiProperty({ example: '0.015', description: 'Decimal string in the crypto asset, up to 8 decimals' })
  @IsString()
  @Matches(DECIMAL_PATTERN, { message: 'amount must be a decimal string with up to 8 decimals' })
  amount: string;
}

export class DepositResponseDto {
  @ApiProperty() id: string;
  @ApiProperty({ enum: CRYPTO_ASSETS }) asset: CryptoAsset;
  @ApiProperty() amount: string;
  @ApiProperty() usdRate: string;
  @ApiProperty() creditAmount: string;
  @ApiProperty() address: string;
  @ApiProperty({ enum: ['pending', 'confirmed'] }) status: 'pending' | 'confirmed';
  @ApiProperty({ nullable: true, type: String }) txHash: string | null;
  @ApiProperty() createdAt: string;
  @ApiProperty({ nullable: true, type: String }) confirmedAt: string | null;
}

/** Body of the provider webhook. */
export class CryptoWebhookDto {
  @ApiProperty() @IsString() eventId: string;

  @ApiProperty({ enum: ['deposit.confirmed'] })
  @IsIn(['deposit.confirmed'])
  type: 'deposit.confirmed';

  @ApiProperty() @IsString() address: string;

  @ApiProperty({ enum: CRYPTO_ASSETS })
  @IsIn(CRYPTO_ASSETS)
  asset: CryptoAsset;

  @ApiProperty()
  @IsString()
  @Matches(DECIMAL_PATTERN)
  amount: string;

  @ApiProperty() @IsString() txHash: string;
}

export class SimulateDepositDto {
  @ApiProperty({ description: 'Id of a pending deposit of the current user' })
  @IsString()
  depositId: string;
}
