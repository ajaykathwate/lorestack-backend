import { Injectable, NotFoundException } from '@nestjs/common';
import { Request } from 'express';
import { createHash } from 'crypto';

import { PrismaService } from '@database/prisma/prisma.service';
import { BlogStatus } from '@prisma/client';

export interface RecordViewOptions {
  sessionId?: string;
  source?: string;
  referrer?: string;
  device?: string;
  viewerId?: string;
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Blog views ────────────────────────────────────────────────────────────────

  async recordBlogView(slug: string, req: Request, opts: RecordViewOptions = {}) {
    const blog = await this.prisma.blog.findUnique({ where: { slug } });
    if (!blog || blog.status !== BlogStatus.published) {
      throw new NotFoundException('Blog not found or not published.');
    }

    // Authors do not inflate their own view counts.
    if (opts.viewerId && opts.viewerId === blog.authorId) {
      return { recorded: false };
    }

    const ip = req.ip ?? req.socket?.remoteAddress ?? '';
    const ipHash = createHash('sha256').update(ip).digest('hex').substring(0, 64);

    // Session-based dedup: one view per (blog, session).
    if (opts.sessionId) {
      const existing = await this.prisma.blogView.findFirst({
        where: { blogId: blog.id, sessionId: opts.sessionId },
        select: { id: true },
      });
      if (existing) return { recorded: false };
    } else {
      // No sessionId — deduplicate by IP within a 30-minute window.
      const recentView = await this.prisma.blogView.findFirst({
        where: {
          blogId: blog.id,
          ipHash,
          viewedAt: { gte: new Date(Date.now() - 30 * 60 * 1000) },
        },
        select: { id: true },
      });
      if (recentView) return { recorded: false };
    }

    await this.prisma.blogView.create({
      data: {
        blogId: blog.id,
        ipHash,
        sessionId: opts.sessionId,
        source: opts.source,
        referrer: opts.referrer,
        device: opts.device,
        ...(opts.viewerId ? { viewerId: opts.viewerId } : {}),
      },
    });

    return { recorded: true };
  }

  async getBlogAnalytics(slug: string, requesterId: string) {
    const blog = await this.prisma.blog.findUnique({
      where: { slug },
      include: { author: true },
    });
    if (!blog) throw new NotFoundException('Blog not found.');
    if (blog.authorId !== requesterId) {
      throw new NotFoundException('Blog not found.');
    }

    const total = await this.prisma.blogView.count({ where: { blogId: blog.id } });

    const now = new Date();
    const startOf30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const last30Days = await this.prisma.blogView.count({
      where: { blogId: blog.id, viewedAt: { gte: startOf30Days } },
    });

    const startOf7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last7Days = await this.prisma.blogView.count({
      where: { blogId: blog.id, viewedAt: { gte: startOf7Days } },
    });

    return { totalViews: total, last30Days, last7Days };
  }

  // ── Company analytics ─────────────────────────────────────────────────────────

  async getCompanyAnalytics(handle: string, requesterId: string) {
    const company = await this.prisma.company.findUnique({ where: { handle } });
    if (!company) throw new NotFoundException('Company not found.');

    const membership = await this.prisma.companyMembership.findFirst({
      where: { companyId: company.id, userId: requesterId, role: 'owner' },
    });
    if (!membership) throw new NotFoundException('Company not found.');

    const [totalBlogs, publishedBlogs, totalViews, totalFollowers] = await Promise.all([
      this.prisma.blog.count({ where: { companyId: company.id } }),
      this.prisma.blog.count({ where: { companyId: company.id, status: BlogStatus.published } }),
      this.prisma.blogView.count({
        where: { blog: { companyId: company.id } },
      }),
      this.prisma.companyFollow.count({ where: { companyId: company.id } }),
    ]);

    return { totalBlogs, publishedBlogs, totalViews, totalFollowers };
  }
}
