import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile, VerifyCallback } from 'passport-google-oauth20';

export interface GoogleProfile {
  googleId: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(configService: ConfigService) {
    const clientID = configService.get<string>('auth.googleClientId');
    const clientSecret = configService.get<string>('auth.googleClientSecret');

    if (!clientID || !clientSecret) {
      throw new Error(
        'Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.',
      );
    }

    super({
      clientID,
      clientSecret,
      callbackURL: configService.get<string>('auth.googleCallbackUrl'),
      scope: ['email', 'profile'],
    });
  }

  validate(_accessToken: string, _refreshToken: string, profile: Profile, done: VerifyCallback) {
    const email = profile.emails?.[0]?.value ?? '';
    const avatarUrl = profile.photos?.[0]?.value ?? null;

    const googleProfile: GoogleProfile = {
      googleId: profile.id,
      email,
      displayName: profile.displayName,
      avatarUrl,
    };

    done(null, googleProfile);
  }
}
