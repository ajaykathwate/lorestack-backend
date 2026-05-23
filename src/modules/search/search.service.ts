import { Injectable } from '@nestjs/common';

import { PrismaService } from '@database/prisma/prisma.service';
import { BlogStatus } from '@prisma/client';

export type SearchType = 'all' | 'articles' | 'authors' | 'companies';

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(q: string, limit: number, type: SearchType = 'all') {
    const term = q.trim();
    if (!term) return { blogs: [], companies: [], authors: [] };

    const runBlogs = type === 'all' || type === 'articles';
    const runCompanies = type === 'all' || type === 'companies';
    const runAuthors = type === 'all' || type === 'authors';

    const [blogs, companies, authors] = await Promise.all([
      runBlogs
        ? this.prisma.blog.findMany({
            where: {
              status: BlogStatus.published,
              OR: [
                { title: { contains: term, mode: 'insensitive' } },
                { summary: { contains: term, mode: 'insensitive' } },
              ],
            },
            select: {
              id: true,
              title: true,
              slug: true,
              summary: true,
              ogImageUrl: true,
              publishedAt: true,
              articleType: true,
              readingTimeMinutes: true,
              author: { include: { authorProfile: true } },
              company: { select: { name: true, handle: true, logoUrl: true } },
              engagementCounters: { select: { likes: true, saves: true, totalViews: true } },
            },
            orderBy: { publishedAt: 'desc' },
            take: limit,
          })
        : Promise.resolve([]),
      runCompanies
        ? this.prisma.company.findMany({
            where: {
              isPublic: true,
              OR: [
                { name: { contains: term, mode: 'insensitive' } },
                { tagline: { contains: term, mode: 'insensitive' } },
              ],
            },
            select: {
              id: true,
              name: true,
              handle: true,
              tagline: true,
              logoUrl: true,
              industry: true,
              stage: true,
            },
            take: limit,
          })
        : Promise.resolve([]),
      runAuthors
        ? this.prisma.authorProfile.findMany({
            where: {
              OR: [
                { displayName: { contains: term, mode: 'insensitive' } },
                { username: { contains: term, mode: 'insensitive' } },
                { bio: { contains: term, mode: 'insensitive' } },
              ],
            },
            select: {
              id: true,
              displayName: true,
              username: true,
              avatarUrl: true,
              bio: true,
              expertiseTags: true,
            },
            take: limit,
          })
        : Promise.resolve([]),
    ]);

    return { blogs, companies, authors };
  }
}
