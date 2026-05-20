import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MilestoneType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateMilestoneDto {
  @ApiProperty({ enum: MilestoneType })
  @IsEnum(MilestoneType)
  type: MilestoneType;

  @ApiProperty({ example: 'Reached 10,000 users', maxLength: 100 })
  @IsString()
  @MaxLength(100)
  headline: string;

  @ApiPropertyOptional({ example: 'Organic growth from Product Hunt launch', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ example: '10k active users', maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  impactMetric?: string;

  @ApiProperty({ example: '2024-03-15', description: 'Date of the milestone (ISO date string)' })
  @Type(() => Date)
  @IsDate()
  milestoneDate: Date;
}
