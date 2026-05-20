import { Module } from '@nestjs/common';

import { AuthorProfilesController } from './controllers/author-profiles.controller';
import { AuthorProfilesRepository } from './repositories/author-profiles.repository';
import { AuthorProfilesService } from './services/author-profiles.service';

@Module({
  controllers: [AuthorProfilesController],
  providers: [AuthorProfilesService, AuthorProfilesRepository],
  exports: [AuthorProfilesService],
})
export class AuthorProfilesModule {}
