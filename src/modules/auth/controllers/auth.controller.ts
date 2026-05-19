import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { Throttle } from '@nestjs/throttler';

import { CurrentUser } from '@common/decorators/current-user.decorator';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';

import { AuthService } from '../services/auth.service';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import { LoginDto } from '../dto/login.dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { ResendVerificationDto } from '../dto/resend-verification.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { VerifyEmailDto } from '../dto/verify-email.dto';
import { AuthRequestContext } from '../interfaces/auth-request-context.interface';
import { JwtUser } from '../types/jwt-user.type';

@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOkResponse({ description: 'Returns a JWT access token.' })
  login(@Body() loginDto: LoginDto, @Req() request: Request) {
    return this.authService.login(loginDto, this.getContext(request));
  }

  @Post('refresh')
  @ApiOkResponse({ description: 'Returns a new JWT access token.' })
  refresh(@Body() refreshTokenDto: RefreshTokenDto, @Req() request: Request) {
    return this.authService.refresh(refreshTokenDto, this.getContext(request));
  }

  @Post('logout')
  @ApiOkResponse({ description: 'Revokes a refresh token.' })
  logout(@Body() refreshTokenDto: RefreshTokenDto, @Req() request: Request) {
    return this.authService.logout(refreshTokenDto, this.getContext(request));
  }

  @Post('forgot-password')
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOkResponse({ description: 'Sends password reset instructions when the account exists.' })
  forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto, @Req() request: Request) {
    return this.authService.forgotPassword(forgotPasswordDto.email, this.getContext(request));
  }

  @Post('reset-password')
  @ApiOkResponse({ description: 'Resets a password using a valid reset token.' })
  resetPassword(@Body() resetPasswordDto: ResetPasswordDto, @Req() request: Request) {
    return this.authService.resetPassword(resetPasswordDto, this.getContext(request));
  }

  @Post('resend-verification')
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOkResponse({ description: 'Sends an email verification link when needed.' })
  resendVerification(
    @Body() resendVerificationDto: ResendVerificationDto,
    @Req() request: Request,
  ) {
    return this.authService.resendVerification(
      resendVerificationDto.identifier,
      this.getContext(request),
    );
  }

  @Post('verify-email')
  @ApiOkResponse({ description: 'Verifies an email address using a valid token.' })
  verifyEmail(@Body() verifyEmailDto: VerifyEmailDto, @Req() request: Request) {
    return this.authService.verifyEmail(verifyEmailDto.token, this.getContext(request));
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Changes the current user password and revokes refresh tokens.' })
  changePassword(
    @CurrentUser() user: JwtUser,
    @Body() changePasswordDto: ChangePasswordDto,
    @Req() request: Request,
  ) {
    return this.authService.changePassword(user.sub, changePasswordDto, this.getContext(request));
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Example protected route.' })
  profile(@CurrentUser() user: JwtUser) {
    return user;
  }

  private getContext(request: Request): AuthRequestContext {
    return {
      ipAddress: request.ip,
      userAgent: request.get('user-agent'),
    };
  }
}
