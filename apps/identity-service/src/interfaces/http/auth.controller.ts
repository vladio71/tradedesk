import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser, Public, REFRESH_TOKEN_COOKIE, SkipCsrf } from '@tradedesk/common';
import { Request, Response } from 'express';
import { GetCurrentUserUseCase } from '../../application/get-current-user.use-case';
import { LoginUserUseCase } from '../../application/login-user.use-case';
import { LogoutUserUseCase } from '../../application/logout-user.use-case';
import { RefreshSessionUseCase } from '../../application/refresh-session.use-case';
import { RegisterUserUseCase } from '../../application/register-user.use-case';
import { AuthCookies } from './auth-cookies.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { UserResponseDto } from './dto/user.dto';
import { toUserResponse } from './mappers/user.mapper';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly registerUser: RegisterUserUseCase,
    private readonly loginUser: LoginUserUseCase,
    private readonly refreshSession: RefreshSessionUseCase,
    private readonly logoutUser: LogoutUserUseCase,
    private readonly getCurrentUser: GetCurrentUserUseCase,
    private readonly cookies: AuthCookies,
  ) {}

  @Public()
  @SkipCsrf()
  @Post('register')
  @ApiOperation({ summary: 'Create an account' })
  async register(@Body() dto: RegisterDto): Promise<UserResponseDto> {
    return toUserResponse(await this.registerUser.execute(dto));
  }

  @Public()
  @SkipCsrf()
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Log in. Sets access_token, refresh_token and csrf_token cookies' })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) response: Response): Promise<UserResponseDto> {
    const session = await this.loginUser.execute(dto);
    this.cookies.setSession(response, session);
    return toUserResponse(session.user);
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Rotate the refresh token and issue new cookies' })
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<UserResponseDto> {
    const session = await this.refreshSession.execute(request.cookies?.[REFRESH_TOKEN_COOKIE]);
    this.cookies.setSession(response, session);
    return toUserResponse(session.user);
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  @ApiOperation({ summary: 'Revoke the refresh token family and clear cookies' })
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<void> {
    await this.logoutUser.execute(request.cookies?.[REFRESH_TOKEN_COOKIE]);
    this.cookies.clear(response);
  }

  @Get('me')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'The signed in user' })
  async me(@CurrentUser() user: AuthUser): Promise<UserResponseDto> {
    return toUserResponse(await this.getCurrentUser.execute(user.id));
  }
}
