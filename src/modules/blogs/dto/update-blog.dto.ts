import { ApiPropertyOptional } from '@nestjs/swagger';
import { ArticleType } from '@prisma/client';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateBlogDto {
  @ApiPropertyOptional({ example: 'How We Scaled to 100k Users', maxLength: 150 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  body?: string;

  @ApiPropertyOptional({ enum: ArticleType })
  @IsOptional()
  @IsEnum(ArticleType)
  articleType?: ArticleType;

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

  @ApiPropertyOptional({ example: 'Learn how we scaled our infrastructure.', maxLength: 160 })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  seoDescOverride?: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['TypeScript', 'NestJS'],
    description: 'Tag names (max 5). New names are created as unapproved tags.',
    maxItems: 5,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(5)
  tags?: string[];
}
