import { forwardRef, Module } from '@nestjs/common';

import { PrismaModule } from '@database/prisma/prisma.module';
import { BlogsModule } from '@modules/blogs/blogs.module';

import { EngagementAggregationService } from './engagement.aggregation.service';
import { EngagementController } from './engagement.controller';
import { EngagementService } from './engagement.service';

@Module({
  imports: [PrismaModule, forwardRef(() => BlogsModule)],
  controllers: [EngagementController],
  providers: [EngagementService, EngagementAggregationService],
  exports: [EngagementService],
})
export class EngagementModule {}
