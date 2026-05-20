import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { render } from '@react-email/render';
import React from 'react';
import { Resend } from 'resend';

import ForgotPasswordEmail from './templates/forgot-password';
import VerifyEmail from './templates/verify-email';
import WelcomeEmail from './templates/welcome-email';
import { SendTemplateEmailOptions } from './interfaces/send-template-email.interface';
import { RESEND_CLIENT } from './resend.provider';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    @Inject(RESEND_CLIENT) private readonly resend: Resend | null,
    private readonly configService: ConfigService,
  ) {}

  async sendWelcomeEmail(to: string, displayName: string) {
    return this.sendTemplateEmail({
      to,
      subject: 'Welcome to Lorestack',
      template: React.createElement(WelcomeEmail, { username: displayName }),
    });
  }

  async sendVerifyEmail(to: string, displayName: string, verificationUrl: string) {
    return this.sendTemplateEmail({
      to,
      subject: 'Verify your Lorestack email',
      template: React.createElement(VerifyEmail, { username: displayName, verificationUrl }),
    });
  }

  async sendForgotPasswordEmail(to: string, displayName: string, resetUrl: string) {
    return this.sendTemplateEmail({
      to,
      subject: 'Reset your Lorestack password',
      template: React.createElement(ForgotPasswordEmail, { username: displayName, resetUrl }),
    });
  }

  async sendEmail(to: string, subject: string, html: string) {
    const from = this.configService.get<string>('mail.from');

    if (!this.resend || !from) {
      this.logger.warn(`Email skipped because Resend is not configured: ${subject}`);
      return { skipped: true };
    }

    try {
      const response = await this.resend.emails.send({ from, to, subject, html });

      if (response.error) {
        this.logger.error(response.error.message, JSON.stringify(response.error));
        throw new Error(response.error.message);
      }

      this.logger.log(`Email sent: ${subject} -> ${to}`);
      return response.data;
    } catch (error) {
      this.logger.error(
        `Failed to send email: ${subject} -> ${to}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  private async sendTemplateEmail({ to, subject, template }: SendTemplateEmailOptions) {
    const from = this.configService.get<string>('mail.from');

    if (!this.resend || !from) {
      this.logger.warn(`Email skipped because Resend is not configured: ${subject}`);
      return { skipped: true };
    }

    try {
      const html = await render(template);
      const text = await render(template, { plainText: true });
      const response = await this.resend.emails.send({ from, to, subject, html, text });

      if (response.error) {
        this.logger.error(response.error.message, JSON.stringify(response.error));
        throw new Error(response.error.message);
      }

      this.logger.log(`Email sent: ${subject} -> ${to}`);
      return response.data;
    } catch (error) {
      this.logger.error(
        `Failed to send email: ${subject} -> ${to}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }
}
