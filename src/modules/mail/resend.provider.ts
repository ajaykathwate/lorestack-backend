import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

export const RESEND_CLIENT = Symbol('RESEND_CLIENT');

export const resendProvider: Provider = {
  provide: RESEND_CLIENT,
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => {
    const apiKey = configService.get<string>('mail.resendApiKey');
    return apiKey ? new Resend(apiKey) : null;
  },
};
