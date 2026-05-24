import { forwardRef, Module } from '@nestjs/common';

import { PrismaModule } from '@database/prisma/prisma.module';
import { BlogsModule } from '@modules/blogs/blogs.module';
import { MailModule } from '@modules/mail/mail.module';

import { CompaniesController } from './controllers/companies.controller';
import { CompaniesRepository } from './repositories/companies.repository';
import { CompaniesService } from './services/companies.service';

@Module({
  imports: [PrismaModule, MailModule, forwardRef(() => BlogsModule)],
  controllers: [CompaniesController],
  providers: [CompaniesService, CompaniesRepository],
  exports: [CompaniesService, CompaniesRepository],
})
export class CompaniesModule {}
