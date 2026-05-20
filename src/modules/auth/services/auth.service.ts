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
import { AuthProvider } from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '@database/prisma/prisma.service';
import { RequestContextData } from '@common/interfaces/request-context.interface';
import { hashToken, generateToken } from '@common/utils/crypto.utils';
import { minutesFromNow, hoursFromNow } from '@common/utils/date.utils';
import { generateUniqueSlug } from '@common/utils/slug.utils';
import { MailService } from '@modules/mail/mail.service';

import { ChangePasswordDto } from '../dto/change-password.dto';
import { LoginDto } from '../dto/login.dto';
import { OnboardingDto } from '../dto/onboarding.dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { RegisterDto } from '../dto/register.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { GoogleProfile } from '../strategies/google.strategy';
import { TokenService } from './token.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly maxFailedLoginAttempts = 5;
  private readonly lockMinutes = 15;

  private get passwordHashRounds(): number {
    return this.configService.get<number>('auth.passwordHashRounds') ?? 12;
  }

  constructor(
    private readonly tokenService: TokenService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  async register(dto: RegisterDto, context: RequestContextData = {}) {
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

  async login(loginDto: LoginDto, context: RequestContextData = {}) {
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

    return this.tokenService.createAuthTokens(user);
  }

  async handleGoogleCallback(googleProfile: GoogleProfile, context: RequestContextData = {}) {
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
    const authResponse = await this.tokenService.createAuthTokens(user);

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

  async refresh(refreshTokenDto: RefreshTokenDto, context: RequestContextData = {}) {
    const tokenHash = hashToken(refreshTokenDto.refreshToken);
    const storedToken = await this.tokenService.findByHash(tokenHash);

    if (!storedToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (storedToken.revokedAt) {
      await this.tokenService.revokeAllForUser(storedToken.userId);
      await this.audit('refresh_token_reuse_detected', storedToken.userId, context);
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (storedToken.expiresAt <= new Date() || storedToken.user.deletedAt) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const newRefreshToken = await this.tokenService.rotateRefreshToken(
      storedToken.id,
      storedToken.userId,
    );

    await this.audit('refresh_token_rotated', storedToken.userId, context);

    const payload = this.tokenService.buildPayload(storedToken.user);

    return {
      accessToken: await this.tokenService.signAsync(payload),
      refreshToken: newRefreshToken,
      tokenType: 'Bearer',
      expiresIn: this.configService.get<string>('auth.jwtExpiresIn'),
    };
  }

  async logout(refreshTokenDto: RefreshTokenDto, context: RequestContextData = {}) {
    await this.tokenService.revokeByHash(hashToken(refreshTokenDto.refreshToken));
    await this.audit('logout', undefined, context);
    return { message: 'Logged out successfully' };
  }

  async forgotPassword(email: string, context: RequestContextData = {}) {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (user && user.provider === AuthProvider.LOCAL && !user.deletedAt) {
      const token = generateToken();
      const resetUrl = this.buildAppUrl('/reset-password', token);
      const displayName = await this.getDisplayName(user.id, user.email);

      await this.prisma.passwordResetToken.create({
        data: {
          tokenHash: hashToken(token),
          userId: user.id,
          expiresAt: minutesFromNow(60),
        },
      });

      await this.mailService.sendForgotPasswordEmail(user.email, displayName, resetUrl);
      await this.audit('forgot_password_requested', user.id, context);
    }

    return { message: 'If the account exists, password reset instructions will be sent.' };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto, context: RequestContextData = {}) {
    const tokenHash = hashToken(resetPasswordDto.token);
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
    ]);

    await this.tokenService.revokeAllForUser(storedToken.userId);
    await this.audit('password_reset_completed', storedToken.userId, context);

    return { message: 'Password reset successfully' };
  }

  async changePassword(
    userId: string,
    changePasswordDto: ChangePasswordDto,
    context: RequestContextData = {},
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

    await this.prisma.user.update({
      where: { id: userId },
      data: { password, passwordChangedAt: new Date() },
    });

    await this.tokenService.revokeAllForUser(userId);
    await this.audit('password_changed', userId, context);

    return { message: 'Password changed successfully. Please sign in again.' };
  }

  async resendVerification(email: string, context: RequestContextData = {}) {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (user && !user.isEmailVerified && user.provider === AuthProvider.LOCAL && !user.deletedAt) {
      const displayName = await this.getDisplayName(user.id, user.email);
      await this.sendVerificationEmail(user.id, user.email, displayName);
      await this.audit('verification_email_requested', user.id, context);
    }

    return { message: 'If the account requires verification, an email will be sent.' };
  }

  async verifyEmail(token: string, context: RequestContextData = {}) {
    const tokenHash = hashToken(token);
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

  private async sendVerificationEmail(userId: string, email: string, displayName: string) {
    const token = generateToken();
    const verificationUrl = this.buildAppUrl('/verify-email', token);

    await this.prisma.emailVerificationToken.create({
      data: { tokenHash: hashToken(token), userId, expiresAt: hoursFromNow(24) },
    });

    await this.mailService.sendVerifyEmail(email, displayName, verificationUrl);
  }

  private async assertLoginAllowed(email: string) {
    const attempt = await this.prisma.loginAttempt.findUnique({
      where: { identifierHash: hashToken(email.toLowerCase()) },
    });

    if (attempt?.lockedUntil && attempt.lockedUntil > new Date()) {
      throw new HttpException(
        'Too many failed login attempts. Try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async recordFailedLogin(email: string) {
    const identifierHash = hashToken(email.toLowerCase());
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
            ? minutesFromNow(this.lockMinutes)
            : undefined,
      },
      update: {
        failedCount,
        lastFailedAt: new Date(),
        lockedUntil:
          failedCount >= this.maxFailedLoginAttempts
            ? minutesFromNow(this.lockMinutes)
            : null,
      },
    });
  }

  private async resetLoginAttempt(email: string) {
    await this.prisma.loginAttempt.deleteMany({
      where: { identifierHash: hashToken(email.toLowerCase()) },
    });
  }

  private async generateUniqueUsername(displayName: string): Promise<string> {
    const base = displayName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-_\s]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 45);

    return generateUniqueSlug(base, async (prefix) => {
      const rows = await this.prisma.authorProfile.findMany({
        where: { username: { startsWith: prefix } },
        select: { username: true },
      });
      return rows.map((r) => r.username);
    });
  }

  private async getDisplayName(userId: string, emailFallback: string): Promise<string> {
    const profile = await this.prisma.authorProfile.findUnique({ where: { userId } });
    return profile?.displayName ?? emailFallback.split('@')[0];
  }

  private async audit(
    event: string,
    userId?: string,
    context: RequestContextData = {},
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

  private buildAppUrl(path: string, token: string) {
    const baseUrl = this.configService.get<string>('mail.appBaseUrl', 'http://localhost:3000');
    const url = new URL(path, baseUrl);
    url.searchParams.set('token', token);
    return url.toString();
  }
}
