import { forwardRef, Module } from '@nestjs/common';

import { CompaniesModule } from '@modules/companies/companies.module';
import { TagsModule } from '@modules/tags/tags.module';

import { BlogsController } from './controllers/blogs.controller';
import { BlogsRepository } from './repositories/blogs.repository';
import { BlogSchedulerService } from './services/blog-scheduler.service';
import { BlogsService } from './services/blogs.service';

@Module({
  imports: [TagsModule, forwardRef(() => CompaniesModule)],
  controllers: [BlogsController],
  providers: [BlogsService, BlogsRepository, BlogSchedulerService],
  exports: [BlogsService, BlogsRepository],
})
export class BlogsModule {}
