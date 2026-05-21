import { Injectable } from '@nestjs/common';
import { ArticleType, BlogStatus, Prisma } from '@prisma/client';

import { PrismaService } from '@database/prisma/prisma.service';

export type SortOrder = 'newest' | 'oldest';

const blogInclude = Prisma.validator<Prisma.BlogInclude>()({
  tags: { include: { tag: true } },
  author: { include: { authorProfile: true } },
  company: true,
});

export type BlogWithTags = Prisma.BlogGetPayload<{ include: typeof blogInclude }>;

export interface ExploreFilters {
  articleType?: ArticleType;
  tagSlug?: string;
  companyId?: string;
  since?: Date;
  skip: number;
  take: number;
  sort?: SortOrder;
}

@Injectable()
export class BlogsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.BlogCreateInput): Promise<BlogWithTags> {
    return this.prisma.blog.create({ data, include: blogInclude });
  }

  findBySlug(slug: string): Promise<BlogWithTags | null> {
    return this.prisma.blog.findUnique({ where: { slug }, include: blogInclude });
  }

  findById(id: string): Promise<BlogWithTags | null> {
    return this.prisma.blog.findUnique({ where: { id }, include: blogInclude });
  }

  findByAuthor(authorId: string, skip = 0, take = 20): Promise<BlogWithTags[]> {
    return this.prisma.blog.findMany({
      where: { authorId },
      include: blogInclude,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
  }

  countByAuthor(authorId: string): Promise<number> {
    return this.prisma.blog.count({ where: { authorId } });
  }

  async countByStatusForAuthor(authorId: string): Promise<{ status: string; _count: number }[]> {
    const rows = await this.prisma.blog.groupBy({
      by: ['status'],
      where: { authorId },
      _count: { _all: true },
    });
    return rows.map((r) => ({ status: r.status as string, _count: r._count._all }));
  }

  findPublishedByAuthorId(
    authorId: string,
    opts: { skip?: number; take?: number; sort?: SortOrder } = {},
  ): Promise<BlogWithTags[]> {
    return this.prisma.blog.findMany({
      where: { authorId, status: BlogStatus.published },
      include: blogInclude,
      orderBy: { publishedAt: opts.sort === 'oldest' ? 'asc' : 'desc' },
      skip: opts.skip ?? 0,
      take: opts.take ?? 20,
    });
  }

  countPublishedByAuthorId(authorId: string): Promise<number> {
    return this.prisma.blog.count({ where: { authorId, status: BlogStatus.published } });
  }

  findPublishedByCompanyId(
    companyId: string,
    opts: { skip?: number; take?: number; sort?: SortOrder } = {},
  ): Promise<BlogWithTags[]> {
    return this.prisma.blog.findMany({
      where: { companyId, status: BlogStatus.published },
      include: blogInclude,
      orderBy: { publishedAt: opts.sort === 'oldest' ? 'asc' : 'desc' },
      skip: opts.skip ?? 0,
      take: opts.take ?? 20,
    });
  }

  countPublishedByCompanyId(companyId: string): Promise<number> {
    return this.prisma.blog.count({ where: { companyId, status: BlogStatus.published } });
  }

  update(id: string, data: Prisma.BlogUpdateInput): Promise<BlogWithTags> {
    return this.prisma.blog.update({ where: { id }, data, include: blogInclude });
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
    const where = this.buildPublishedWhere(filters);
    return this.prisma.blog.findMany({
      where,
      include: blogInclude,
      orderBy: { publishedAt: filters.sort === 'oldest' ? 'asc' : 'desc' },
      skip: filters.skip,
      take: filters.take,
    });
  }

  countPublished(filters: Omit<ExploreFilters, 'skip' | 'take' | 'sort'>): Promise<number> {
    return this.prisma.blog.count({ where: this.buildPublishedWhere(filters) });
  }

  findTrending(limit: number): Promise<BlogWithTags[]> {
    return this.prisma.blog.findMany({
      where: {
        status: BlogStatus.published,
        publishedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
      include: blogInclude,
      orderBy: [{ views: { _count: 'desc' } }, { publishedAt: 'desc' }],
      take: limit,
    });
  }

  private buildPublishedWhere(filters: Omit<ExploreFilters, 'skip' | 'take' | 'sort'>): Prisma.BlogWhereInput {
    return {
      status: BlogStatus.published,
      ...(filters.articleType ? { articleType: filters.articleType } : {}),
      ...(filters.companyId ? { companyId: filters.companyId } : {}),
      ...(filters.since ? { publishedAt: { gte: filters.since } } : {}),
      ...(filters.tagSlug ? { tags: { some: { tag: { slug: filters.tagSlug } } } } : {}),
    };
  }

  slugExists(slug: string): Promise<boolean> {
    return this.prisma.blog.findUnique({ where: { slug } }).then((b) => b !== null);
  }

  findSlugsByPrefix(prefix: string): Promise<string[]> {
    return this.prisma.blog
      .findMany({ where: { slug: { startsWith: prefix } }, select: { slug: true } })
      .then((rows) => rows.map((r) => r.slug));
  }

  findDueScheduled(): Promise<BlogWithTags[]> {
    return this.prisma.blog.findMany({
      where: {
        status: BlogStatus.scheduled,
        scheduledAt: { lte: new Date() },
      },
      include: blogInclude,
    });
  }
}
