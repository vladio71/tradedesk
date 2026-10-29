import { Body, Controller, Get, HttpCode, Patch, Post, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser, mapPage, Page, Roles } from '@tradedesk/common';
import { ChangePasswordUseCase } from '../../application/change-password.use-case';
import { ListUsersUseCase } from '../../application/list-users.use-case';
import { UpdateProfileUseCase } from '../../application/update-profile.use-case';
import { ChangePasswordDto, ListUsersQueryDto, UpdateProfileDto, UserResponseDto } from './dto/user.dto';
import { toUserResponse } from './mappers/user.mapper';

@ApiTags('users')
@ApiCookieAuth()
@Controller('users')
export class UsersController {
  constructor(
    private readonly updateProfile: UpdateProfileUseCase,
    private readonly changePassword: ChangePasswordUseCase,
    private readonly listUsers: ListUsersUseCase,
  ) {}

  @Patch('me')
  @ApiOperation({ summary: 'Update own profile' })
  async updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto): Promise<UserResponseDto> {
    return toUserResponse(await this.updateProfile.execute({ userId: user.id, displayName: dto.displayName }));
  }

  @Post('me/password')
  @HttpCode(204)
  @ApiOperation({ summary: 'Change own password. Signs out all sessions' })
  async changeMyPassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto): Promise<void> {
    await this.changePassword.execute({ userId: user.id, currentPassword: dto.currentPassword, newPassword: dto.newPassword });
  }

  @Get()
  @Roles('admin')
  @ApiOperation({ summary: 'List users (admin)' })
  async list(@Query() query: ListUsersQueryDto): Promise<Page<UserResponseDto>> {
    const page = await this.listUsers.execute({ page: query.page, pageSize: query.pageSize, q: query.q, role: query.role });
    return mapPage(page, toUserResponse);
  }
}
