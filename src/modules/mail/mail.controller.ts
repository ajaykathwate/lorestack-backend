import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';

import { SendEmailDto } from './dto/send-email.dto';
import { MailService } from './mail.service';

@ApiTags('mail')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@Controller({ path: 'mail', version: '1' })
export class MailController {
  constructor(private readonly mailService: MailService) {}

  @Post('send')
  @ApiOkResponse({ description: 'Sends a custom HTML email.' })
  send(@Body() sendEmailDto: SendEmailDto) {
    return this.mailService.sendEmail(sendEmailDto.to, sendEmailDto.subject, sendEmailDto.html);
  }
}
