import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { Throttle } from '@nestjs/throttler';

import { CurrentUser } from '@common/decorators/current-user.decorator';
import { Public } from '@common/decorators/public.decorator';

import { AuthService } from '../services/auth.service';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import { LoginDto } from '../dto/login.dto';
import { OnboardingDto } from '../dto/onboarding.dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { RegisterDto } from '../dto/register.dto';
import { ResendVerificationDto } from '../dto/resend-verification.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { VerifyEmailDto } from '../dto/verify-email.dto';
import { AuthRequestContext } from '../interfaces/auth-request-context.interface';
import { GoogleProfile } from '../strategies/google.strategy';
import { JwtUser } from '../types/jwt-user.type';

@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOkResponse({ description: 'Sends a verification email after creating the account.' })
  register(@Body() registerDto: RegisterDto, @Req() request: Request) {
    return this.authService.register(registerDto, this.getContext(request));
  }

  @Post('login')
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOkResponse({ description: 'Returns a JWT access token.' })
  login(@Body() loginDto: LoginDto, @Req() request: Request) {
    return this.authService.login(loginDto, this.getContext(request));
  }

  @Get('google')
  @Public()
  @UseGuards(AuthGuard('google'))
  @ApiOkResponse({ description: 'Redirects to Google OAuth consent screen.' })
  googleAuth() {
    // Passport handles the redirect — this method body is never reached.
  }

  @Get('google/callback')
  @Public()
  @UseGuards(AuthGuard('google'))
  @ApiOkResponse({ description: 'Google OAuth callback — returns JWT tokens.' })
  googleCallback(@Req() request: Request) {
    const googleProfile = request.user as GoogleProfile;
    return this.authService.handleGoogleCallback(googleProfile, this.getContext(request));
  }

  @Post('onboarding')
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Creates the author profile for the authenticated user.' })
  onboarding(@CurrentUser() user: JwtUser, @Body() onboardingDto: OnboardingDto) {
    return this.authService.onboarding(user.sub, onboardingDto);
  }

  @Post('refresh')
  @Public()
  @ApiOkResponse({ description: 'Returns a new JWT access token.' })
  refresh(@Body() refreshTokenDto: RefreshTokenDto, @Req() request: Request) {
    return this.authService.refresh(refreshTokenDto, this.getContext(request));
  }

  @Post('logout')
  @Public()
  @ApiOkResponse({ description: 'Revokes a refresh token.' })
  logout(@Body() refreshTokenDto: RefreshTokenDto, @Req() request: Request) {
    return this.authService.logout(refreshTokenDto, this.getContext(request));
  }

  @Post('forgot-password')
  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOkResponse({ description: 'Sends password reset instructions when the account exists.' })
  forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto, @Req() request: Request) {
    return this.authService.forgotPassword(forgotPasswordDto.email, this.getContext(request));
  }

  @Post('reset-password')
  @Public()
  @ApiOkResponse({ description: 'Resets a password using a valid reset token.' })
  resetPassword(@Body() resetPasswordDto: ResetPasswordDto, @Req() request: Request) {
    return this.authService.resetPassword(resetPasswordDto, this.getContext(request));
  }

  @Post('resend-verification')
  @Public()
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
  @Public()
  @ApiOkResponse({ description: 'Verifies an email address using a valid token.' })
  verifyEmail(@Body() verifyEmailDto: VerifyEmailDto, @Req() request: Request) {
    return this.authService.verifyEmail(verifyEmailDto.token, this.getContext(request));
  }

  @Post('change-password')
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Changes the current user password and revokes refresh tokens.' })
  changePassword(
    @CurrentUser() user: JwtUser,
    @Body() changePasswordDto: ChangePasswordDto,
    @Req() request: Request,
  ) {
    return this.authService.changePassword(user.sub, changePasswordDto, this.getContext(request));
  }

  private getContext(request: Request): AuthRequestContext {
    return {
      ipAddress: request.ip,
      userAgent: request.get('user-agent'),
    };
  }
}
