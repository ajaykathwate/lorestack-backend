import { Module } from '@nestjs/common';

import { PrismaModule } from '@database/prisma/prisma.module';

import { EngagementAggregationService } from './engagement.aggregation.service';
import { EngagementController } from './engagement.controller';
import { EngagementService } from './engagement.service';

@Module({
  imports: [PrismaModule],
  controllers: [EngagementController],
  providers: [EngagementService, EngagementAggregationService],
  exports: [EngagementService],
})
export class EngagementModule {}
