import { Module } from '@nestjs/common';

import { BlogsModule } from '@modules/blogs/blogs.module';

import { AuthorProfilesController } from './controllers/author-profiles.controller';
import { AuthorProfilesRepository } from './repositories/author-profiles.repository';
import { AuthorProfilesService } from './services/author-profiles.service';

@Module({
  imports: [BlogsModule],
  controllers: [AuthorProfilesController],
  providers: [AuthorProfilesService, AuthorProfilesRepository],
  exports: [AuthorProfilesService],
})
export class AuthorProfilesModule {}
