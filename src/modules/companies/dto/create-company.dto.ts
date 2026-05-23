import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CompanyStage, IndustryType } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateCompanyDto {
  @ApiProperty({ example: 'Acme Corp', maxLength: 100 })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: 'acme-corp', description: 'Unique URL handle (slug)', maxLength: 50 })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @Matches(/^[a-z0-9-]+$/, { message: 'handle may only contain lowercase letters, numbers, and hyphens' })
  handle: string;

  @ApiProperty({ example: 'Building the future of developer tooling', maxLength: 160 })
  @IsString()
  @MaxLength(160)
  tagline: string;

  @ApiPropertyOptional({ example: 'https://acme.com' })
  @IsOptional()
  @IsUrl()
  websiteUrl?: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/logo.png' })
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/cover.png' })
  @IsOptional()
  @IsString()
  coverImageUrl?: string;

  @ApiPropertyOptional({ enum: IndustryType })
  @IsOptional()
  @IsEnum(IndustryType)
  industry?: IndustryType;

  @ApiPropertyOptional({ enum: CompanyStage })
  @IsOptional()
  @IsEnum(CompanyStage)
  stage?: CompanyStage;

  @ApiPropertyOptional({ type: [String], example: ['TypeScript', 'NestJS', 'PostgreSQL'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }: { value: unknown }) => (Array.isArray(value) ? value : []))
  techStack?: string[];

  @ApiPropertyOptional({
    type: [String],
    maxItems: 5,
    example: ['https://cdn.example.com/office.png', 'https://cdn.example.com/team.png'],
    description: 'Up to 5 gallery image URLs for the company page (team photos, office, product screenshots, etc.)',
  })
  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  @ArrayMaxSize(5)
  galleryImages?: string[];

  @ApiPropertyOptional({ example: 'https://twitter.com/founderhandle' })
  @IsOptional()
  @IsString()
  founderSocialLink?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}
