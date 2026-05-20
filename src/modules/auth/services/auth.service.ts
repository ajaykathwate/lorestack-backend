import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthProvider } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';

import { PrismaService } from '@database/prisma/prisma.service';
import { MailService } from '@modules/mail/mail.service';

import { ChangePasswordDto } from '../dto/change-password.dto';
import { LoginDto } from '../dto/login.dto';
import { OnboardingDto } from '../dto/onboarding.dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { RegisterDto } from '../dto/register.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { TokenPayload } from '../interfaces/token-payload.interface';
import { AuthRequestContext } from '../interfaces/auth-request-context.interface';
import { GoogleProfile } from '../strategies/google.strategy';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly maxFailedLoginAttempts = 5;
  private readonly lockMinutes = 15;

  private get passwordHashRounds(): number {
    return this.configService.get<number>('auth.passwordHashRounds') ?? 12;
  }

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  async register(dto: RegisterDto, context: AuthRequestContext = {}) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('An account with this email already exists.');
    }

    const password = await bcrypt.hash(dto.password, this.passwordHashRounds);
    const user = await this.prisma.user.create({
      data: { email: dto.email, password, provider: AuthProvider.LOCAL },
    });

    await this.sendVerificationEmail(user.id, user.email, dto.fullName);
    await this.audit('register', user.id, context);

    return { message: 'Check your inbox to verify your email.' };
  }

  async login(loginDto: LoginDto, context: AuthRequestContext = {}) {
    await this.assertLoginAllowed(loginDto.email);

    const user = await this.prisma.user.findUnique({ where: { email: loginDto.email } });

    if (!user || user.deletedAt) {
      await this.recordFailedLogin(loginDto.email);
      throw new UnauthorizedException('No account found with this email address.');
    }

    if (!user.isActive) {
      await this.audit('login_blocked_suspended', user.id, context);
      throw new UnauthorizedException('Your account has been suspended. Contact support.');
    }

    if (user.provider !== AuthProvider.LOCAL || !user.password) {
      throw new UnauthorizedException(
        'This account uses Google sign-in. Please continue with Google.',
      );
    }

    const passwordMatch = await bcrypt.compare(loginDto.password, user.password);
    if (!passwordMatch) {
      await this.recordFailedLogin(loginDto.email);
      await this.audit('login_failed', user.id, context);
      throw new UnauthorizedException('Incorrect password.');
    }

    if (!user.isEmailVerified) {
      await this.audit('login_blocked_unverified_email', user.id, context);
      throw new UnauthorizedException('Please verify your email before signing in.');
    }

    await this.resetLoginAttempt(loginDto.email);
    await this.audit('login_success', user.id, context);

    return this.createAuthResponse(user);
  }

  async handleGoogleCallback(googleProfile: GoogleProfile, context: AuthRequestContext = {}) {
    let user = await this.prisma.user.findUnique({ where: { email: googleProfile.email } });

    if (user && user.deletedAt) {
      throw new UnauthorizedException('This account has been removed.');
    }

    if (user && !user.isActive) {
      throw new UnauthorizedException('Your account has been suspended. Contact support.');
    }

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email: googleProfile.email,
          provider: AuthProvider.GOOGLE,
          providerId: googleProfile.googleId,
          isEmailVerified: true,
        },
      });
      await this.audit('google_register', user.id, context);
    } else if (!user.providerId) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { providerId: googleProfile.googleId, isEmailVerified: true },
      });
      await this.audit('google_account_linked', user.id, context);
    } else {
      await this.audit('google_login', user.id, context);
    }

    const hasProfile = await this.prisma.authorProfile.findUnique({ where: { userId: user.id } });
    const authResponse = await this.createAuthResponse(user);

    return { ...authResponse, onboardingRequired: !hasProfile };
  }

  async onboarding(userId: string, dto: OnboardingDto) {
    const existing = await this.prisma.authorProfile.findUnique({ where: { userId } });
    if (existing) {
      throw new ConflictException('Onboarding already completed.');
    }

    const username = await this.generateUniqueUsername(dto.displayName);

    const profile = await this.prisma.authorProfile.create({
      data: {
        userId,
        displayName: dto.displayName,
        username,
        avatarUrl: dto.avatarUrl ?? null,
      },
    });

    return profile;
  }

  async refresh(refreshTokenDto: RefreshTokenDto, context: AuthRequestContext = {}) {
    const tokenHash = this.hashToken(refreshTokenDto.refreshToken);
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!storedToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (storedToken.revokedAt) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: storedToken.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.audit('refresh_token_reuse_detected', storedToken.userId, context);
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (storedToken.expiresAt <= new Date() || storedToken.user.deletedAt) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const newRefreshToken = await this.createRefreshToken(storedToken.userId);
    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date(), replacedBy: this.hashToken(newRefreshToken) },
    });

    await this.audit('refresh_token_rotated', storedToken.userId, context);

    const payload = this.createPayload(storedToken.user);

    return {
      accessToken: await this.jwtService.signAsync(payload),
      refreshToken: newRefreshToken,
      tokenType: 'Bearer',
      expiresIn: this.configService.get<string>('auth.jwtExpiresIn'),
    };
  }

  async logout(refreshTokenDto: RefreshTokenDto, context: AuthRequestContext = {}) {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: this.hashToken(refreshTokenDto.refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await this.audit('logout', undefined, context);

    return { message: 'Logged out successfully' };
  }

  async forgotPassword(email: string, context: AuthRequestContext = {}) {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (user && user.provider === AuthProvider.LOCAL && !user.deletedAt) {
      const token = this.generateToken();
      const resetUrl = this.buildAppUrl('/reset-password', token);
      const displayName = await this.getDisplayName(user.id, user.email);

      await this.prisma.passwordResetToken.create({
        data: {
          tokenHash: this.hashToken(token),
          userId: user.id,
          expiresAt: this.minutesFromNow(60),
        },
      });

      await this.mailService.sendForgotPasswordEmail(user.email, displayName, resetUrl);
      await this.audit('forgot_password_requested', user.id, context);
    }

    return { message: 'If the account exists, password reset instructions will be sent.' };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto, context: AuthRequestContext = {}) {
    const tokenHash = this.hashToken(resetPasswordDto.token);
    const storedToken = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!storedToken || storedToken.usedAt || storedToken.expiresAt <= new Date()) {
      throw new BadRequestException('Invalid or expired password reset token');
    }

    if (storedToken.user.provider !== AuthProvider.LOCAL) {
      throw new BadRequestException('Password reset is not available for social login accounts.');
    }

    const password = await bcrypt.hash(resetPasswordDto.password, this.passwordHashRounds);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: storedToken.userId },
        data: { password, passwordChangedAt: new Date() },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: storedToken.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: storedToken.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    await this.audit('password_reset_completed', storedToken.userId, context);

    return { message: 'Password reset successfully' };
  }

  async changePassword(
    userId: string,
    changePasswordDto: ChangePasswordDto,
    context: AuthRequestContext = {},
  ) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, isActive: true } });

    if (!user) {
      throw new UnauthorizedException('User not found or account is inactive');
    }

    if (user.provider !== AuthProvider.LOCAL || !user.password) {
      throw new BadRequestException('Password change is not available for social login accounts.');
    }

    if (!(await bcrypt.compare(changePasswordDto.currentPassword, user.password))) {
      throw new UnauthorizedException('Invalid current password');
    }

    const password = await bcrypt.hash(changePasswordDto.newPassword, this.passwordHashRounds);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { password, passwordChangedAt: new Date() },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    await this.audit('password_changed', userId, context);

    return { message: 'Password changed successfully. Please sign in again.' };
  }

  async resendVerification(email: string, context: AuthRequestContext = {}) {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (user && !user.isEmailVerified && user.provider === AuthProvider.LOCAL && !user.deletedAt) {
      const displayName = await this.getDisplayName(user.id, user.email);
      await this.sendVerificationEmail(user.id, user.email, displayName);
      await this.audit('verification_email_requested', user.id, context);
    }

    return { message: 'If the account requires verification, an email will be sent.' };
  }

  async verifyEmail(token: string, context: AuthRequestContext = {}) {
    const tokenHash = this.hashToken(token);
    const storedToken = await this.prisma.emailVerificationToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!storedToken || storedToken.usedAt || storedToken.expiresAt <= new Date()) {
      throw new BadRequestException('Invalid or expired email verification token');
    }

    const displayName = await this.getDisplayName(storedToken.userId, storedToken.user.email);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: storedToken.userId },
        data: { isEmailVerified: true },
      }),
      this.prisma.emailVerificationToken.update({
        where: { id: storedToken.id },
        data: { usedAt: new Date() },
      }),
    ]);

    await this.mailService.sendWelcomeEmail(storedToken.user.email, displayName);
    await this.audit('email_verified', storedToken.userId, context);

    return { message: 'Email verified successfully' };
  }

  private async createAuthResponse(user: {
    id: string;
    email: string;
    platformRole: import('@prisma/client').PlatformRole;
  }) {
    const payload = this.createPayload(user);
    const refreshToken = await this.createRefreshToken(user.id);

    return {
      accessToken: await this.jwtService.signAsync(payload),
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: this.configService.get<string>('auth.jwtExpiresIn'),
    };
  }

  private async sendVerificationEmail(userId: string, email: string, displayName: string) {
    const token = this.generateToken();
    const verificationUrl = this.buildAppUrl('/verify-email', token);

    await this.prisma.emailVerificationToken.create({
      data: { tokenHash: this.hashToken(token), userId, expiresAt: this.hoursFromNow(24) },
    });

    await this.mailService.sendVerifyEmail(email, displayName, verificationUrl);
  }

  private async createRefreshToken(userId: string) {
    const token = this.generateToken();
    const expiresInDays = this.configService.get<number>('auth.jwtRefreshExpiresInDays', 7);

    await this.prisma.refreshToken.create({
      data: {
        tokenHash: this.hashToken(token),
        userId,
        expiresAt: this.daysFromNow(expiresInDays),
      },
    });

    return token;
  }

  private async assertLoginAllowed(email: string) {
    const attempt = await this.prisma.loginAttempt.findUnique({
      where: { identifierHash: this.hashToken(email.toLowerCase()) },
    });

    if (attempt?.lockedUntil && attempt.lockedUntil > new Date()) {
      throw new HttpException(
        'Too many failed login attempts. Try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async recordFailedLogin(email: string) {
    const identifierHash = this.hashToken(email.toLowerCase());
    const existing = await this.prisma.loginAttempt.findUnique({ where: { identifierHash } });
    const failedCount = (existing?.failedCount ?? 0) + 1;

    await this.prisma.loginAttempt.upsert({
      where: { identifierHash },
      create: {
        identifierHash,
        failedCount,
        lastFailedAt: new Date(),
        lockedUntil:
          failedCount >= this.maxFailedLoginAttempts
            ? this.minutesFromNow(this.lockMinutes)
            : undefined,
      },
      update: {
        failedCount,
        lastFailedAt: new Date(),
        lockedUntil:
          failedCount >= this.maxFailedLoginAttempts ? this.minutesFromNow(this.lockMinutes) : null,
      },
    });
  }

  private async resetLoginAttempt(email: string) {
    await this.prisma.loginAttempt.deleteMany({
      where: { identifierHash: this.hashToken(email.toLowerCase()) },
    });
  }

  private async generateUniqueUsername(displayName: string): Promise<string> {
    const base = displayName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-_\s]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 45);

    let candidate = base;
    let suffix = 0;

    while (true) {
      const exists = await this.prisma.authorProfile.findUnique({ where: { username: candidate } });
      if (!exists) return candidate;
      suffix += 1;
      candidate = `${base}-${suffix}`;
    }
  }

  private async getDisplayName(userId: string, emailFallback: string): Promise<string> {
    const profile = await this.prisma.authorProfile.findUnique({ where: { userId } });
    return profile?.displayName ?? emailFallback.split('@')[0];
  }

  private async audit(
    event: string,
    userId?: string,
    context: AuthRequestContext = {},
    metadata?: Record<string, string>,
  ) {
    try {
      await this.prisma.authAuditLog.create({
        data: {
          event,
          userId,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          metadata,
        },
      });
    } catch {
      this.logger.warn(`Failed to write auth audit log: ${event}`);
    }
  }

  private createPayload(user: {
    id: string;
    email: string;
    platformRole: import('@prisma/client').PlatformRole;
  }): TokenPayload {
    return { sub: user.id, email: user.email, platformRole: user.platformRole };
  }

  private generateToken() {
    return randomBytes(32).toString('base64url');
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private buildAppUrl(path: string, token: string) {
    const baseUrl = this.configService.get<string>('mail.appBaseUrl', 'http://localhost:3000');
    const url = new URL(path, baseUrl);
    url.searchParams.set('token', token);
    return url.toString();
  }

  private minutesFromNow(minutes: number) {
    return new Date(Date.now() + minutes * 60 * 1000);
  }

  private hoursFromNow(hours: number) {
    return new Date(Date.now() + hours * 60 * 60 * 1000);
  }

  private daysFromNow(days: number) {
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }
}
