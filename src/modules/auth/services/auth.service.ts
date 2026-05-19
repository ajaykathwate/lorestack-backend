import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { UserEntity } from '@modules/users/entities/user.entity';
import { UsersService } from '@modules/users/services/users.service';

import { LoginDto } from '../dto/login.dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { TokenPayload } from '../interfaces/token-payload.interface';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(loginDto: LoginDto) {
    const user = await this.validateUser(loginDto.identifier, loginDto.password);
    const payload: TokenPayload = {
      sub: user.id,
      email: user.email,
      username: user.username,
    };

    return {
      accessToken: await this.jwtService.signAsync(payload),
      refreshToken: await this.jwtService.signAsync(
        { ...payload, tokenUse: 'refresh' },
        { expiresIn: '7d' },
      ),
      tokenType: 'Bearer',
      expiresIn: this.configService.get<string>('auth.jwtExpiresIn'),
      user: new UserEntity(user),
    };
  }

  async refresh(refreshTokenDto: RefreshTokenDto) {
    try {
      const payload = await this.jwtService.verifyAsync<TokenPayload & { tokenUse?: string }>(
        refreshTokenDto.refreshToken,
      );

      if (payload.tokenUse !== 'refresh') {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const accessPayload: TokenPayload = {
        sub: payload.sub,
        email: payload.email,
        username: payload.username,
      };

      return {
        accessToken: await this.jwtService.signAsync(accessPayload),
        tokenType: 'Bearer',
        expiresIn: this.configService.get<string>('auth.jwtExpiresIn'),
      };
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  forgotPassword(email: string) {
    void email;

    return {
      message: 'If the account exists, password reset instructions will be sent.',
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
}
