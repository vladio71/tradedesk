import { Controller, Get, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '@tradedesk/common';
import { GetVolumeReportUseCase } from '../../application/get-volume-report.use-case';
import { VolumeQueryDto, VolumeRowResponseDto } from './dto/transfer.dto';

@ApiTags('reports')
@ApiCookieAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly volumeReport: GetVolumeReportUseCase) {}

  @Get('volume')
  @ApiOperation({ summary: 'My transfer volume per day with a running total' })
  volume(@CurrentUser() user: AuthUser, @Query() query: VolumeQueryDto): Promise<VolumeRowResponseDto[]> {
    return this.volumeReport.execute({
      userId: user.id,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
    });
  }
}
