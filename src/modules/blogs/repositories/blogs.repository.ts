import { Injectable } from '@nestjs/common';
import { ArticleType, BlogStatus, Prisma } from '@prisma/client';

import { PrismaService } from '@database/prisma/prisma.service';

const blogWithTags = Prisma.validator<Prisma.BlogInclude>()({
  tags: { include: { tag: true } },
});

export type BlogWithTags = Prisma.BlogGetPayload<{ include: typeof blogWithTags }>;

export interface ExploreFilters {
  articleType?: ArticleType;
  tagSlug?: string;
  companyId?: string;
  since?: Date;
  skip: number;
  take: number;
}

@Injectable()
export class BlogsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.BlogCreateInput): Promise<BlogWithTags> {
    return this.prisma.blog.create({ data, include: blogWithTags });
  }

  findBySlug(slug: string): Promise<BlogWithTags | null> {
    return this.prisma.blog.findUnique({ where: { slug }, include: blogWithTags });
  }

  findById(id: string): Promise<BlogWithTags | null> {
    return this.prisma.blog.findUnique({ where: { id }, include: blogWithTags });
  }

  findByAuthor(authorId: string): Promise<BlogWithTags[]> {
    return this.prisma.blog.findMany({
      where: { authorId },
      include: blogWithTags,
      orderBy: { createdAt: 'desc' },
    });
  }

  findPublishedByAuthorId(authorId: string): Promise<BlogWithTags[]> {
    return this.prisma.blog.findMany({
      where: { authorId, status: BlogStatus.published },
      include: blogWithTags,
      orderBy: { publishedAt: 'desc' },
    });
  }

  findPublishedByCompanyId(companyId: string): Promise<BlogWithTags[]> {
    return this.prisma.blog.findMany({
      where: { companyId, status: BlogStatus.published },
      include: blogWithTags,
      orderBy: { publishedAt: 'desc' },
    });
  }

  update(id: string, data: Prisma.BlogUpdateInput): Promise<BlogWithTags> {
    return this.prisma.blog.update({ where: { id }, data, include: blogWithTags });
  }

  delete(id: string) {
    return this.prisma.blog.delete({ where: { id } });
  }

  replaceTags(blogId: string, tagIds: string[]) {
    return this.prisma.$transaction([
      this.prisma.blogTag.deleteMany({ where: { blogId } }),
      ...tagIds.map((tagId) => this.prisma.blogTag.create({ data: { blogId, tagId } })),
    ]);
  }

  findPublished(filters: ExploreFilters): Promise<BlogWithTags[]> {
    const where: Prisma.BlogWhereInput = {
      status: BlogStatus.published,
      ...(filters.articleType ? { articleType: filters.articleType } : {}),
      ...(filters.companyId ? { companyId: filters.companyId } : {}),
      ...(filters.since ? { publishedAt: { gte: filters.since } } : {}),
      ...(filters.tagSlug
        ? { tags: { some: { tag: { slug: filters.tagSlug } } } }
        : {}),
    };

    return this.prisma.blog.findMany({
      where,
      include: blogWithTags,
      orderBy: { publishedAt: 'desc' },
      skip: filters.skip,
      take: filters.take,
    });
  }

  slugExists(slug: string): Promise<boolean> {
    return this.prisma.blog.findUnique({ where: { slug } }).then((b) => b !== null);
  }

  findDueScheduled(): Promise<BlogWithTags[]> {
    return this.prisma.blog.findMany({
      where: {
        status: BlogStatus.scheduled,
        scheduledAt: { lte: new Date() },
      },
      include: blogWithTags,
    });
  }
}
