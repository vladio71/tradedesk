import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { DECIMAL_PATTERN } from './deposit.dto';

export class CreateTransferDto {
  @ApiProperty({ description: 'User id of the recipient' })
  @IsUUID()
  recipientUserId: string;

  @ApiProperty({ example: '10.5', description: 'Decimal string, USD' })
  @IsString()
  @Matches(DECIMAL_PATTERN, { message: 'amount must be a decimal string with up to 8 decimals' })
  amount: string;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}

export class TransferResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() fromUserId: string;
  @ApiProperty() toUserId: string;
  @ApiProperty() amount: string;
  @ApiProperty() status: string;
  @ApiProperty({ nullable: true, type: String }) note: string | null;
  @ApiProperty({ enum: ['out', 'in'], description: 'Direction from the point of view of the caller' }) direction: 'out' | 'in';
  @ApiProperty() createdAt: string;
}

export class VolumeQueryDto {
  @ApiPropertyOptional({ description: 'ISO date, inclusive. Default: 30 days before "to"' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'ISO date, exclusive. Default: tomorrow' })
  @IsOptional()
  @IsDateString()
  to?: string;
}

export class VolumeRowResponseDto {
  @ApiProperty() day: string;
  @ApiProperty() transfersCount: number;
  @ApiProperty() volume: string;
  @ApiProperty() runningTotal: string;
}
