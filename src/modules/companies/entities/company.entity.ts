import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CompanyStage, IndustryType } from '@prisma/client';

export class CompanyEntity {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  createdByUserId: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  handle: string;

  @ApiProperty()
  tagline: string;

  @ApiPropertyOptional({ nullable: true })
  websiteUrl?: string | null;

  @ApiPropertyOptional({ nullable: true })
  logoUrl?: string | null;

  @ApiPropertyOptional({ nullable: true })
  coverImageUrl?: string | null;

  @ApiPropertyOptional({ enum: IndustryType, nullable: true })
  industry?: IndustryType | null;

  @ApiPropertyOptional({ enum: CompanyStage, nullable: true })
  stage?: CompanyStage | null;

  @ApiProperty({ type: [String] })
  techStack: string[];

  @ApiPropertyOptional({ nullable: true })
  founderSocialLink?: string | null;

  @ApiProperty()
  isPublic: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  constructor(partial: Partial<CompanyEntity>) {
    Object.assign(this, partial);
  }
}
