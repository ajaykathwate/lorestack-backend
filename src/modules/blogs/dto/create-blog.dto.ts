import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArticleType } from '@prisma/client';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateBlogDto {
  @ApiProperty({ example: 'How We Scaled to 100k Users', maxLength: 150 })
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  title: string;

  @ApiPropertyOptional({ example: '# Introduction\n\nWe started with a simple idea...' })
  @IsOptional()
  @IsString()
  body?: string;

  @ApiProperty({ enum: ArticleType })
  @IsEnum(ArticleType)
  articleType: ArticleType;

  @ApiPropertyOptional({ format: 'uuid', description: 'Associate with a company (must be a member)' })
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiPropertyOptional({ example: 'A story about scaling our SaaS from zero to 100k.', maxLength: 300 })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  summary?: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/cover.png' })
  @IsOptional()
  @IsString()
  coverImageUrl?: string;

  @ApiPropertyOptional({ example: 'How We Scaled to 100k Users | Acme Blog', maxLength: 60 })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  seoTitleOverride?: string;

  @ApiPropertyOptional({ example: 'Learn how we scaled our infrastructure to handle 100k daily users.', maxLength: 160 })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  seoDescOverride?: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['TypeScript', 'NestJS', 'Scaling'],
    description: 'Tag names (max 5). New names are created as unapproved tags.',
    maxItems: 5,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(5)
  tags?: string[];
}
