import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MilestoneType } from '@prisma/client';

export class CompanyMilestoneEntity {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  companyId: string;

  @ApiProperty({ format: 'uuid' })
  createdByUserId: string;

  @ApiProperty({ enum: MilestoneType })
  type: MilestoneType;

  @ApiProperty()
  headline: string;

  @ApiPropertyOptional({ nullable: true })
  description?: string | null;

  @ApiPropertyOptional({ nullable: true })
  impactMetric?: string | null;

  @ApiProperty()
  milestoneDate: Date;

  @ApiProperty()
  createdAt: Date;

  constructor(partial: Partial<CompanyMilestoneEntity>) {
    Object.assign(this, partial);
  }
}
