import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { CurrentUser } from '@common/decorators/current-user.decorator';
import { Public } from '@common/decorators/public.decorator';
import { RequestContext } from '@common/decorators/request-context.decorator';
import { RequestContextData } from '@common/interfaces/request-context.interface';

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
  register(
    @Body() registerDto: RegisterDto,
    @RequestContext() ctx: RequestContextData,
  ) {
    return this.authService.register(registerDto, ctx);
  }

  @Post('login')
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOkResponse({ description: 'Returns a JWT access token.' })
  login(@Body() loginDto: LoginDto, @RequestContext() ctx: RequestContextData) {
    return this.authService.login(loginDto, ctx);
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
  googleCallback(
    @CurrentUser() googleProfile: GoogleProfile,
    @RequestContext() ctx: RequestContextData,
  ) {
    return this.authService.handleGoogleCallback(googleProfile, ctx);
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
  refresh(
    @Body() refreshTokenDto: RefreshTokenDto,
    @RequestContext() ctx: RequestContextData,
  ) {
    return this.authService.refresh(refreshTokenDto, ctx);
  }

  @Post('logout')
  @Public()
  @ApiOkResponse({ description: 'Revokes a refresh token.' })
  logout(@Body() refreshTokenDto: RefreshTokenDto, @RequestContext() ctx: RequestContextData) {
    return this.authService.logout(refreshTokenDto, ctx);
  }

  @Post('forgot-password')
  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOkResponse({ description: 'Sends password reset instructions when the account exists.' })
  forgotPassword(
    @Body() forgotPasswordDto: ForgotPasswordDto,
    @RequestContext() ctx: RequestContextData,
  ) {
    return this.authService.forgotPassword(forgotPasswordDto.email, ctx);
  }

  @Post('reset-password')
  @Public()
  @ApiOkResponse({ description: 'Resets a password using a valid reset token.' })
  resetPassword(
    @Body() resetPasswordDto: ResetPasswordDto,
    @RequestContext() ctx: RequestContextData,
  ) {
    return this.authService.resetPassword(resetPasswordDto, ctx);
  }

  @Post('resend-verification')
  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOkResponse({ description: 'Sends an email verification link when needed.' })
  resendVerification(
    @Body() resendVerificationDto: ResendVerificationDto,
    @RequestContext() ctx: RequestContextData,
  ) {
    return this.authService.resendVerification(resendVerificationDto.email, ctx);
  }

  @Post('verify-email')
  @Public()
  @ApiOkResponse({ description: 'Verifies an email address using a valid token.' })
  verifyEmail(
    @Body() verifyEmailDto: VerifyEmailDto,
    @RequestContext() ctx: RequestContextData,
  ) {
    return this.authService.verifyEmail(verifyEmailDto.token, ctx);
  }

  @Post('change-password')
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Changes the current user password and revokes refresh tokens.' })
  changePassword(
    @CurrentUser() user: JwtUser,
    @Body() changePasswordDto: ChangePasswordDto,
    @RequestContext() ctx: RequestContextData,
  ) {
    return this.authService.changePassword(user.sub, changePasswordDto, ctx);
  }
}
