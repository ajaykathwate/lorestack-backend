import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BlogStatus } from '@prisma/client';

import { PrismaService } from '@database/prisma/prisma.service';

@Injectable()
export class EngagementAggregationService {
  private readonly logger = new Logger(EngagementAggregationService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Runs every 15 minutes to recompute engagement counters and trending scores.
  @Cron(CronExpression.EVERY_10_MINUTES)
  async aggregateEngagementCounters() {
    this.logger.log('Aggregating engagement counters...');

    const publishedBlogs = await this.prisma.blog.findMany({
      where: { status: BlogStatus.published },
      select: { id: true, publishedAt: true },
    });

    if (publishedBlogs.length === 0) return;

    // Fetch all engagement data in 6 parallel queries (not per-blog)
    const [viewGroups, likeCounts, saveCounts, shareCounts, sessions] = await Promise.all([
      this.prisma.blogView.groupBy({ by: ['blogId'], _count: { id: true } }),
      this.prisma.blogLike.groupBy({ by: ['blogId'], _count: { id: true } }),
      this.prisma.blogSave.groupBy({ by: ['blogId'], _count: { id: true } }),
      this.prisma.blogShare.groupBy({ by: ['blogId'], _count: { id: true } }),
      this.prisma.blogReadSession.findMany({
        select: { blogId: true, maxScrollDepth: true, completed: true },
      }),
    ]);

    // Unique views: count distinct ipHash per blog
    const uniqueViewGroups = await this.prisma.blogView.groupBy({
      by: ['blogId', 'ipHash'],
      where: { ipHash: { not: null } },
    });

    const toMap = <T extends { blogId: string }>(arr: T[], key: (t: T) => number) =>
      new Map(arr.map((r) => [r.blogId, key(r)]));

    const totalViewMap = toMap(viewGroups, (r) => r._count.id);
    const likeMap = toMap(likeCounts, (r) => r._count.id);
    const saveMap = toMap(saveCounts, (r) => r._count.id);
    const shareMap = toMap(shareCounts, (r) => r._count.id);

    // Unique views per blog
    const uniqueViewMap = new Map<string, number>();
    for (const row of uniqueViewGroups) {
      uniqueViewMap.set(row.blogId, (uniqueViewMap.get(row.blogId) ?? 0) + 1);
    }

    // Completion rate per blog
    const sessionMap = new Map<string, { sum: number; count: number }>();
    for (const s of sessions) {
      const current = sessionMap.get(s.blogId) ?? { sum: 0, count: 0 };
      const contribution = s.completed ? 1.0 : s.maxScrollDepth / 100;
      sessionMap.set(s.blogId, { sum: current.sum + contribution, count: current.count + 1 });
    }

    const now = Date.now();

    const upserts = publishedBlogs.map((blog) => {
      const totalViews = totalViewMap.get(blog.id) ?? 0;
      const uniqueViews = uniqueViewMap.get(blog.id) ?? 0;
      const likes = likeMap.get(blog.id) ?? 0;
      const saves = saveMap.get(blog.id) ?? 0;
      const shares = shareMap.get(blog.id) ?? 0;

      const sessionData = sessionMap.get(blog.id);
      const avgCompletionRate = sessionData && sessionData.count > 0 ? sessionData.sum / sessionData.count : 0;

      // Time-decayed trending score: strong signals (saves, shares) weighted higher than raw views.
      // TimeDecay = (hoursSincePublished + 2)^1.5 — prevents old articles from dominating.
      const hoursSincePublished = blog.publishedAt
        ? (now - blog.publishedAt.getTime()) / (1000 * 60 * 60)
        : 0;
      const timeDecay = Math.pow(hoursSincePublished + 2, 1.5);
      const trendingScore =
        (4 * uniqueViews + 8 * saves + 10 * shares + 3 * avgCompletionRate * 100) / timeDecay;

      return this.prisma.blogEngagementCounters.upsert({
        where: { blogId: blog.id },
        create: {
          blogId: blog.id,
          totalViews,
          uniqueViews,
          likes,
          saves,
          shares,
          avgCompletionRate,
          trendingScore,
        },
        update: {
          totalViews,
          uniqueViews,
          likes,
          saves,
          shares,
          avgCompletionRate,
          trendingScore,
        },
      });
    });

    await this.prisma.$transaction(upserts);
    this.logger.log(`Aggregated engagement counters for ${publishedBlogs.length} blogs.`);
  }
}
