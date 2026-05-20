import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsOptional, IsString, MaxLength, MinDate } from 'class-validator';

export class ScheduleBlogDto {
  @ApiProperty({ example: '2026-06-01T10:00:00.000Z', description: 'Must be a future datetime' })
  @Type(() => Date)
  @IsDate()
  @MinDate(new Date(), { message: 'scheduledAt must be in the future' })
  scheduledAt: Date;

  @ApiPropertyOptional({ example: 'Asia/Kolkata', maxLength: 100, default: 'UTC' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  scheduledTimezone?: string;
}
