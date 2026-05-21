import { Injectable } from '@nestjs/common';

import { PrismaService } from '@database/prisma/prisma.service';
import { BlogStatus } from '@prisma/client';

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(q: string, limit: number) {
    const term = q.trim();
    if (!term) return { blogs: [], companies: [], authors: [] };

    const [blogs, companies, authors] = await Promise.all([
      this.prisma.blog.findMany({
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
          author: { include: { authorProfile: true } },
        },
        orderBy: { publishedAt: 'desc' },
        take: limit,
      }),
      this.prisma.company.findMany({
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
        },
        take: limit,
      }),
      this.prisma.authorProfile.findMany({
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
        },
        take: limit,
      }),
    ]);

    return { blogs, companies, authors };
  }
}
