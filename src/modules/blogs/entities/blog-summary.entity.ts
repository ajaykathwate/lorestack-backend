import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArticleType, BlogStatus } from '@prisma/client';

import { TagEntity } from '@modules/tags/entities/tag.entity';
import { EmbeddedAuthorProfile, EmbeddedCompany } from './blog.entity';

export class BlogSummaryEntity {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  authorId: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  companyId?: string | null;

  @ApiProperty()
  title: string;

  @ApiProperty()
  slug: string;

  @ApiPropertyOptional({ nullable: true })
  summary?: string | null;

  @ApiPropertyOptional({ nullable: true })
  coverImageUrl?: string | null;

  @ApiProperty()
  ogImageUrl: string;

  @ApiProperty({ enum: ArticleType })
  articleType: ArticleType;

  @ApiProperty({ enum: BlogStatus })
  status: BlogStatus;

  @ApiPropertyOptional({ nullable: true })
  publishedAt?: Date | null;

  @ApiPropertyOptional({ nullable: true })
  scheduledAt?: Date | null;

  @ApiPropertyOptional({ nullable: true })
  scheduledTimezone?: string | null;

  @ApiPropertyOptional({ nullable: true })
  readingTimeMinutes?: number | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional({ type: () => TagEntity, isArray: true })
  tags?: TagEntity[];

  @ApiPropertyOptional({ type: () => EmbeddedAuthorProfile, nullable: true })
  authorProfile?: EmbeddedAuthorProfile | null;

  @ApiPropertyOptional({ type: () => EmbeddedCompany, nullable: true })
  company?: EmbeddedCompany | null;

  @ApiProperty()
  likesCount: number;

  @ApiProperty()
  savesCount: number;

  @ApiProperty()
  viewsCount: number;

  constructor(partial: Partial<BlogSummaryEntity>) {
    Object.assign(this, partial);
  }
}
