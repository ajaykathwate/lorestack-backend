import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';

import { UserEntity } from '@modules/users/entities/user.entity';
import { UsersService } from '@modules/users/services/users.service';
import { PrismaService } from '@database/prisma/prisma.service';
import { PASSWORD_HASH_ROUNDS } from '@common/constants/app.constants';
import { MailService } from '@modules/mail/mail.service';

import { ChangePasswordDto } from '../dto/change-password.dto';
import { LoginDto } from '../dto/login.dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { TokenPayload } from '../interfaces/token-payload.interface';
import { AuthRequestContext } from '../interfaces/auth-request-context.interface';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly maxFailedLoginAttempts = 5;
  private readonly lockMinutes = 15;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  async login(loginDto: LoginDto, context: AuthRequestContext = {}) {
    await this.assertLoginAllowed(loginDto.identifier, context.ipAddress);

    try {
      const user = await this.validateUser(loginDto.identifier, loginDto.password);

      if (!user.emailVerifiedAt) {
        await this.audit('login_blocked_unverified_email', user.id, context);
        throw new UnauthorizedException('Please verify your email before signing in');
      }

      await this.resetLoginAttempt(loginDto.identifier, context.ipAddress);
      await this.audit('login_success', user.id, context);

      return this.createAuthResponse(user);
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        await this.recordFailedLogin(loginDto.identifier, context.ipAddress);
        await this.audit('login_failed', undefined, context, {
          identifier: this.hashToken(loginDto.identifier.toLowerCase()),
        });
      }

      throw error;
    }
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
      data: {
        revokedAt: new Date(),
        replacedBy: this.hashToken(newRefreshToken),
      },
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
    const user = await this.usersService.findByEmail(email);

    if (user) {
      const token = this.generateToken();
      const resetUrl = this.buildAppUrl('/reset-password', token);

      await this.prisma.passwordResetToken.create({
        data: {
          tokenHash: this.hashToken(token),
          userId: user.id,
          expiresAt: this.minutesFromNow(30),
        },
      });

      await this.mailService.sendForgotPasswordEmail(user.email, user.username, resetUrl);
      await this.audit('forgot_password_requested', user.id, context);
    }

    return {
      message: 'If the account exists, password reset instructions will be sent.',
    };
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

    const password = await bcrypt.hash(resetPasswordDto.password, PASSWORD_HASH_ROUNDS);

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
    const user = await this.prisma.user.findFirst({ where: { id: userId, deletedAt: null } });

    if (!user || !(await bcrypt.compare(changePasswordDto.currentPassword, user.password))) {
      throw new UnauthorizedException('Invalid current password');
    }

    const password = await bcrypt.hash(changePasswordDto.newPassword, PASSWORD_HASH_ROUNDS);

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

  async resendVerification(identifier: string, context: AuthRequestContext = {}) {
    const user = identifier.includes('@')
      ? await this.usersService.findByEmail(identifier)
      : await this.usersService.findByUsername(identifier);

    if (user && !user.emailVerifiedAt) {
      await this.sendVerificationEmail(user.id, user.email, user.username);
      await this.audit('verification_email_requested', user.id, context);
    }

    return {
      message: 'If the account requires verification, an email will be sent.',
    };
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

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: storedToken.userId },
        data: { emailVerifiedAt: new Date() },
      }),
      this.prisma.emailVerificationToken.update({
        where: { id: storedToken.id },
        data: { usedAt: new Date() },
      }),
    ]);

    await this.mailService.sendWelcomeEmail(storedToken.user.email, storedToken.user.username);
    await this.audit('email_verified', storedToken.userId, context);

    return { message: 'Email verified successfully' };
  }

  private async createAuthResponse(user: {
    id: string;
    email: string;
    username: string;
    password: string;
    createdAt: Date;
    updatedAt: Date;
    emailVerifiedAt: Date | null;
    passwordChangedAt: Date | null;
    deletedAt: Date | null;
  }) {
    const payload: TokenPayload = {
      sub: user.id,
      email: user.email,
      username: user.username,
    };
    const refreshToken = await this.createRefreshToken(user.id);

    return {
      accessToken: await this.jwtService.signAsync(payload),
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: this.configService.get<string>('auth.jwtExpiresIn'),
      user: new UserEntity(user),
    };
  }

  async validateUser(identifier: string, password: string) {
    const user = identifier.includes('@')
      ? await this.usersService.findByEmail(identifier)
      : await this.usersService.findByUsername(identifier);

    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return user;
  }

  private async sendVerificationEmail(userId: string, email: string, username: string) {
    const token = this.generateToken();
    const verificationUrl = this.buildAppUrl('/verify-email', token);

    await this.prisma.emailVerificationToken.create({
      data: {
        tokenHash: this.hashToken(token),
        userId,
        expiresAt: this.hoursFromNow(24),
      },
    });

    await this.mailService.sendVerifyEmail(email, username, verificationUrl);
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

  private async assertLoginAllowed(identifier: string, ipAddress?: string) {
    const attempt = await this.prisma.loginAttempt.findUnique({
      where: {
        identifierHash_ipAddress: {
          identifierHash: this.hashToken(identifier.toLowerCase()),
          ipAddress: ipAddress ?? '',
        },
      },
    });

    if (attempt?.lockedUntil && attempt.lockedUntil > new Date()) {
      throw new HttpException(
        'Too many failed login attempts. Try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async recordFailedLogin(identifier: string, ipAddress?: string) {
    const where = {
      identifierHash_ipAddress: {
        identifierHash: this.hashToken(identifier.toLowerCase()),
        ipAddress: ipAddress ?? '',
      },
    };
    const existing = await this.prisma.loginAttempt.findUnique({ where });
    const failedCount = (existing?.failedCount ?? 0) + 1;

    await this.prisma.loginAttempt.upsert({
      where,
      create: {
        identifierHash: where.identifierHash_ipAddress.identifierHash,
        ipAddress: where.identifierHash_ipAddress.ipAddress,
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

  private async resetLoginAttempt(identifier: string, ipAddress?: string) {
    await this.prisma.loginAttempt.deleteMany({
      where: {
        identifierHash: this.hashToken(identifier.toLowerCase()),
        ipAddress: ipAddress ?? '',
      },
    });
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

  private createPayload(user: { id: string; email: string; username: string }): TokenPayload {
    return {
      sub: user.id,
      email: user.email,
      username: user.username,
    };
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
