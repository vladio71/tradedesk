import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PageQueryDto } from '@tradedesk/common';
import { IsDateString, IsIn, IsOptional } from 'class-validator';
import { LEDGER_KINDS, LedgerKind } from '../../../domain/ledger-entry';

export class WalletResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() userId: string;
  @ApiProperty({ example: '125.50000000', description: 'Balance in USD, decimal string' }) balance: string;
  @ApiProperty() updatedAt: string;
}

export class LedgerQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: LEDGER_KINDS })
  @IsOptional()
  @IsIn(LEDGER_KINDS)
  kind?: LedgerKind;

  @ApiPropertyOptional({ description: 'ISO date, inclusive' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'ISO date, exclusive' })
  @IsOptional()
  @IsDateString()
  to?: string;
}

export class LedgerEntryResponseDto {
  @ApiProperty() id: string;
  @ApiProperty({ enum: LEDGER_KINDS }) kind: LedgerKind;
  @ApiProperty({ enum: ['credit', 'debit'] }) direction: 'credit' | 'debit';
  @ApiProperty() amount: string;
  @ApiProperty() balanceAfter: string;
  @ApiProperty() referenceId: string;
  @ApiProperty() createdAt: string;
}
