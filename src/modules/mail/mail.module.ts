import { Module } from '@nestjs/common';

import { MailController } from './mail.controller';
import { MailService } from './mail.service';
import { resendProvider } from './resend.provider';

@Module({
  controllers: [MailController],
  providers: [resendProvider, MailService],
  exports: [MailService],
})
export class MailModule {}
