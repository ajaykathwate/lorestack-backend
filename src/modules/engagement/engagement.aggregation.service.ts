import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BlogStatus } from '@prisma/client';

import { PrismaService } from '@database/prisma/prisma.service';

@Injectable()
export class EngagementAggregationService {
  private readonly logger = new Logger(EngagementAggregationService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Runs every 10 minutes to recompute engagement counters and trending scores.
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

    type ExistingCounter = { blogId: string; totalViews: number; uniqueViews: number; likes: number; saves: number; shares: number; trendingScore: number };
    const existingCounters: ExistingCounter[] = await this.prisma.blogEngagementCounters.findMany({
      where: { blogId: { in: publishedBlogs.map((b) => b.id) } },
      select: { blogId: true, totalViews: true, uniqueViews: true, likes: true, saves: true, shares: true, trendingScore: true },
    });
    const existingMap = new Map<string, ExistingCounter>();
    for (const c of existingCounters) existingMap.set(c.blogId, c);

    type NewCounter = {
      blogId: string;
      totalViews: number;
      uniqueViews: number;
      likes: number;
      saves: number;
      shares: number;
      avgCompletionRate: number;
      trendingScore: number;
    };
    const newCounters: NewCounter[] = [];

    const upserts = publishedBlogs.map((blog) => {
      const totalViews = totalViewMap.get(blog.id) ?? 0;
      const uniqueViews = uniqueViewMap.get(blog.id) ?? 0;
      const likes = likeMap.get(blog.id) ?? 0;
      const saves = saveMap.get(blog.id) ?? 0;
      const shares = shareMap.get(blog.id) ?? 0;

      const sessionData = sessionMap.get(blog.id);
      const avgCompletionRate = sessionData && sessionData.count > 0 ? sessionData.sum / sessionData.count : 0;

      // Time-decayed trending score. Weights reflect intent strength:
      //   shares (10) > saves (8) > likes (6) > unique views (4) > completion rate
      // TimeDecay = (hoursSincePublished + 2)^1.5 — prevents old articles from dominating.
      const hoursSincePublished = blog.publishedAt
        ? (now - blog.publishedAt.getTime()) / (1000 * 60 * 60)
        : 0;
      const timeDecay = Math.pow(hoursSincePublished + 2, 1.5);
      const trendingScore =
        (4 * uniqueViews + 6 * likes + 8 * saves + 10 * shares + 3 * avgCompletionRate * 100) /
        timeDecay;

      newCounters.push({ blogId: blog.id, totalViews, uniqueViews, likes, saves, shares, avgCompletionRate, trendingScore });

      return this.prisma.blogEngagementCounters.upsert({
        where: { blogId: blog.id },
        create: { blogId: blog.id, totalViews, uniqueViews, likes, saves, shares, avgCompletionRate, trendingScore },
        update: { totalViews, uniqueViews, likes, saves, shares, avgCompletionRate, trendingScore },
      });
    });

    await this.prisma.$transaction(upserts);

    // Compute aggregate deltas across all blogs
    let deltaViews = 0, deltaLikes = 0, deltaSaves = 0, deltaShares = 0;
    let newBlogs = 0;

    for (const n of newCounters) {
      const prev = existingMap.get(n.blogId);
      if (!prev) {
        newBlogs++;
        deltaViews += n.totalViews;
        deltaLikes += n.likes;
        deltaSaves += n.saves;
        deltaShares += n.shares;
      } else {
        deltaViews += n.totalViews - prev.totalViews;
        deltaLikes += n.likes - prev.likes;
        deltaSaves += n.saves - prev.saves;
        deltaShares += n.shares - prev.shares;
      }
    }

    const prevTotals = newCounters.reduce(
      (acc, n) => {
        const prev = existingMap.get(n.blogId);
        acc.views += prev?.totalViews ?? 0;
        acc.likes += prev?.likes ?? 0;
        acc.saves += prev?.saves ?? 0;
        acc.shares += prev?.shares ?? 0;
        return acc;
      },
      { views: 0, likes: 0, saves: 0, shares: 0 },
    );

    const newTotals = newCounters.reduce(
      (acc, n) => {
        acc.views += n.totalViews;
        acc.likes += n.likes;
        acc.saves += n.saves;
        acc.shares += n.shares;
        return acc;
      },
      { views: 0, likes: 0, saves: 0, shares: 0 },
    );

    this.logger.log(
      `Engagement aggregation complete — ${publishedBlogs.length} blogs (${newBlogs} new)` +
      ` | views: ${prevTotals.views} → ${newTotals.views} (+${deltaViews})` +
      ` | likes: ${prevTotals.likes} → ${newTotals.likes} (+${deltaLikes})` +
      ` | saves: ${prevTotals.saves} → ${newTotals.saves} (+${deltaSaves})` +
      ` | shares: ${prevTotals.shares} → ${newTotals.shares} (+${deltaShares})`,
    );
  }
}
