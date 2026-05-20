import { Module } from '@nestjs/common';

import { BlogsModule } from '@modules/blogs/blogs.module';

import { DiscoveryController } from './controllers/discovery.controller';

@Module({
  imports: [BlogsModule],
  controllers: [DiscoveryController],
})
export class DiscoveryModule {}
