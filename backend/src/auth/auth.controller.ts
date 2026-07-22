import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { MfaCodeDto } from './dto/mfa-code.dto';
import { Public } from './decorators/public.decorator';
import { Roles } from './decorators/roles.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import type { AuthenticatedUser } from './strategies/jwt.strategy';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @HttpCode(HttpStatus.OK)
  @Post('logout')
  async logout(@Body() dto: RefreshTokenDto) {
    await this.authService.logout(dto.refreshToken);
    return { message: 'Logged out' };
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }

  @Post('mfa/setup')
  setupMfa(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.setupMfa(user.userId);
  }

  @HttpCode(HttpStatus.OK)
  @Post('mfa/enable')
  enableMfa(@CurrentUser() user: AuthenticatedUser, @Body() dto: MfaCodeDto) {
    return this.authService.enableMfa(user.userId, dto.code);
  }

  @HttpCode(HttpStatus.OK)
  @Post('mfa/disable')
  disableMfa(@CurrentUser() user: AuthenticatedUser, @Body() dto: MfaCodeDto) {
    return this.authService.disableMfa(user.userId, dto.code);
  }

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getMe(user.userId);
  }

  // Demonstrates RBAC: only Super Admins and Cooperative Admins may call this.
  @Roles(Role.SUPER_ADMIN, Role.COOPERATIVE_ADMIN)
  @Get('admin-only')
  adminOnly(@CurrentUser() user: AuthenticatedUser) {
    return { message: `Hello admin ${user.email}` };
  }
}
