import { Injectable, NotFoundException } from '@nestjs/common';
import { Request } from 'express';
import { createHash } from 'crypto';

import { PrismaService } from '@database/prisma/prisma.service';
import { BlogStatus } from '@prisma/client';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Blog views ────────────────────────────────────────────────────────────────

  async recordBlogView(slug: string, req: Request) {
    const blog = await this.prisma.blog.findUnique({ where: { slug } });
    if (!blog || blog.status !== BlogStatus.published) {
      throw new NotFoundException('Blog not found or not published.');
    }

    const ip = req.ip ?? req.socket?.remoteAddress ?? '';
    const ipHash = createHash('sha256').update(ip).digest('hex').substring(0, 64);

    await this.prisma.blogView.create({
      data: {
        blogId: blog.id,
        ipHash,
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
