import { Module } from '@nestjs/common';

import { PrismaModule } from '@database/prisma/prisma.module';
import { BlogsModule } from '@modules/blogs/blogs.module';

import { DiscoveryController } from './controllers/discovery.controller';
import { DiscoveryService } from './services/discovery.service';

@Module({
  imports: [BlogsModule, PrismaModule],
  controllers: [DiscoveryController],
  providers: [DiscoveryService],
})
export class DiscoveryModule {}
