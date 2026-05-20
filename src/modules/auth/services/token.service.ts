import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PlatformRole } from '@prisma/client';

import { PrismaService } from '@database/prisma/prisma.service';
import { daysFromNow } from '@common/utils/date.utils';
import { generateToken, hashToken } from '@common/utils/crypto.utils';

import { TokenPayload } from '../interfaces/token-payload.interface';

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async createAuthTokens(user: { id: string; email: string; platformRole: PlatformRole }) {
    const payload = this.buildPayload(user);
    const refreshToken = await this.issueRefreshToken(user.id);

    return {
      accessToken: await this.jwtService.signAsync(payload),
      refreshToken,
      tokenType: 'Bearer' as const,
      expiresIn: this.configService.get<string>('auth.jwtExpiresIn'),
    };
  }

  async issueRefreshToken(userId: string): Promise<string> {
    const token = generateToken();
    const expiresInDays = this.configService.get<number>('auth.jwtRefreshExpiresInDays', 7);

    await this.prisma.refreshToken.create({
      data: { tokenHash: hashToken(token), userId, expiresAt: daysFromNow(expiresInDays) },
    });

    return token;
  }

  async rotateRefreshToken(oldTokenId: string, userId: string): Promise<string> {
    const newToken = generateToken();
    const expiresInDays = this.configService.get<number>('auth.jwtRefreshExpiresInDays', 7);
    const newHash = hashToken(newToken);

    await this.prisma.$transaction([
      this.prisma.refreshToken.create({
        data: { tokenHash: newHash, userId, expiresAt: daysFromNow(expiresInDays) },
      }),
      this.prisma.refreshToken.update({
        where: { id: oldTokenId },
        data: { revokedAt: new Date(), replacedBy: newHash },
      }),
    ]);

    return newToken;
  }

  revokeByHash(tokenHash: string) {
    return this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  revokeAllForUser(userId: string) {
    return this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  findByHash(tokenHash: string) {
    return this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
  }

  buildPayload(user: { id: string; email: string; platformRole: PlatformRole }): TokenPayload {
    return { sub: user.id, email: user.email, platformRole: user.platformRole };
  }

  signAsync(payload: TokenPayload): Promise<string> {
    return this.jwtService.signAsync(payload);
  }
}
