import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BlogStatus } from '@prisma/client';

import { PrismaService } from '@database/prisma/prisma.service';
import { BlogsRepository } from '@modules/blogs/repositories/blogs.repository';
import { toBlogSummaryEntity } from '@modules/blogs/mappers/blog.mappers';
import { NOTIFICATION_EVENTS } from '@modules/notifications/events/notification-event-names';
import { BlogLikedEvent, BlogSavedEvent, BlogSharedEvent } from '@modules/notifications/events/notification.events';

import { ReadProgressDto } from './dto/read-progress.dto';
import { ShareBlogDto } from './dto/share-blog.dto';

@Injectable()
export class EngagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly blogsRepo: BlogsRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ── Likes ─────────────────────────────────────────────────────────────────────

  async likeBlog(slug: string, userId: string) {
    const blog = await this.findPublishedBlog(slug);

    if (blog.authorId === userId) {
      throw new BadRequestException('You cannot like your own article.');
    }

    const existing = await this.prisma.blogLike.findUnique({
      where: { uq_blog_likes_user_blog: { userId, blogId: blog.id } },
    });
    if (existing) throw new ConflictException('You have already liked this blog.');

    await this.prisma.blogLike.create({ data: { userId, blogId: blog.id } });
    const likesCount = await this.prisma.blogLike.count({ where: { blogId: blog.id } });

    if (blog.authorId !== userId) {
      const actorProfile = await this.prisma.authorProfile.findUnique({
        where: { userId },
        select: { displayName: true, username: true, avatarUrl: true },
      });
      if (actorProfile) {
        const event = Object.assign(new BlogLikedEvent(), {
          actorUserId: userId,
          actorDisplayName: actorProfile.displayName,
          actorUsername: actorProfile.username,
          actorAvatarUrl: actorProfile.avatarUrl,
          blogId: blog.id,
          blogSlug: blog.slug,
          blogTitle: blog.title,
          authorUserId: blog.authorId,
        });
        setImmediate(() => this.eventEmitter.emit(NOTIFICATION_EVENTS.BLOG_LIKED, event));
      }
    }

    return { likesCount };
  }

  async unlikeBlog(slug: string, userId: string) {
    const blog = await this.findPublishedBlog(slug);

    const existing = await this.prisma.blogLike.findUnique({
      where: { uq_blog_likes_user_blog: { userId, blogId: blog.id } },
    });
    if (!existing) throw new NotFoundException('You have not liked this blog.');

    await this.prisma.blogLike.delete({
      where: { uq_blog_likes_user_blog: { userId, blogId: blog.id } },
    });
    const likesCount = await this.prisma.blogLike.count({ where: { blogId: blog.id } });
    return { likesCount };
  }

  // ── Saves ─────────────────────────────────────────────────────────────────────

  async saveBlog(slug: string, userId: string) {
    const blog = await this.findPublishedBlog(slug);

    if (blog.authorId === userId) {
      throw new BadRequestException('You cannot save your own article.');
    }

    const existing = await this.prisma.blogSave.findUnique({
      where: { uq_blog_saves_user_blog: { userId, blogId: blog.id } },
    });
    if (existing) throw new ConflictException('You have already saved this blog.');

    await this.prisma.blogSave.create({ data: { userId, blogId: blog.id } });
    const savesCount = await this.prisma.blogSave.count({ where: { blogId: blog.id } });

    if (blog.authorId !== userId) {
      const actorProfile = await this.prisma.authorProfile.findUnique({
        where: { userId },
        select: { displayName: true, username: true, avatarUrl: true },
      });
      if (actorProfile) {
        const event = Object.assign(new BlogSavedEvent(), {
          actorUserId: userId,
          actorDisplayName: actorProfile.displayName,
          actorUsername: actorProfile.username,
          actorAvatarUrl: actorProfile.avatarUrl,
          blogId: blog.id,
          blogSlug: blog.slug,
          blogTitle: blog.title,
          authorUserId: blog.authorId,
        });
        setImmediate(() => this.eventEmitter.emit(NOTIFICATION_EVENTS.BLOG_SAVED, event));
      }
    }

    return { savesCount };
  }

  async unsaveBlog(slug: string, userId: string) {
    const blog = await this.findPublishedBlog(slug);

    const existing = await this.prisma.blogSave.findUnique({
      where: { uq_blog_saves_user_blog: { userId, blogId: blog.id } },
    });
    if (!existing) throw new NotFoundException('You have not saved this blog.');

    await this.prisma.blogSave.delete({
      where: { uq_blog_saves_user_blog: { userId, blogId: blog.id } },
    });
    const savesCount = await this.prisma.blogSave.count({ where: { blogId: blog.id } });
    return { savesCount };
  }

  // ── Shares ────────────────────────────────────────────────────────────────────

  async shareBlog(slug: string, dto: ShareBlogDto, userId?: string) {
    const blog = await this.findPublishedBlog(slug);

    await this.prisma.blogShare.create({
      data: {
        blogId: blog.id,
        channel: dto.channel,
        ...(userId ? { userId } : {}),
      },
    });

    const sharesCount = await this.prisma.blogShare.count({ where: { blogId: blog.id } });

    if (userId && blog.authorId !== userId) {
      const actorProfile = await this.prisma.authorProfile.findUnique({
        where: { userId },
        select: { displayName: true, username: true, avatarUrl: true },
      });
      if (actorProfile) {
        const event = Object.assign(new BlogSharedEvent(), {
          actorUserId: userId,
          actorDisplayName: actorProfile.displayName,
          actorUsername: actorProfile.username,
          actorAvatarUrl: actorProfile.avatarUrl,
          blogId: blog.id,
          blogSlug: blog.slug,
          blogTitle: blog.title,
          authorUserId: blog.authorId,
          channel: dto.channel ?? null,
        });
        setImmediate(() => this.eventEmitter.emit(NOTIFICATION_EVENTS.BLOG_SHARED, event));
      }
    }

    return { sharesCount };
  }

  // ── Read sessions ─────────────────────────────────────────────────────────────

  async upsertReadSession(slug: string, dto: ReadProgressDto, userId?: string) {
    const blog = await this.findPublishedBlog(slug);

    const completed = dto.completed ?? dto.maxScrollDepth >= 80;

    await this.prisma.blogReadSession.upsert({
      where: { uq_read_session_blog_session: { blogId: blog.id, sessionId: dto.sessionId } },
      create: {
        blogId: blog.id,
        sessionId: dto.sessionId,
        maxScrollDepth: dto.maxScrollDepth,
        readDurationSeconds: dto.readDurationSeconds,
        completed,
        ...(userId ? { userId } : {}),
      },
      update: {
        maxScrollDepth: dto.maxScrollDepth,
        readDurationSeconds: dto.readDurationSeconds,
        completed,
        lastEventAt: new Date(),
      },
    });

    return { recorded: true };
  }

  // ── Engagement summary ────────────────────────────────────────────────────────

  async getBlogEngagement(slug: string) {
    const blog = await this.findPublishedBlog(slug);

    const counters = await this.prisma.blogEngagementCounters.findUnique({
      where: { blogId: blog.id },
    });

    return {
      likesCount: counters?.likes ?? 0,
      savesCount: counters?.saves ?? 0,
      sharesCount: counters?.shares ?? 0,
      totalViews: counters?.totalViews ?? 0,
      uniqueViews: counters?.uniqueViews ?? 0,
      avgCompletionRate: counters?.avgCompletionRate ?? 0,
      trendingScore: counters?.trendingScore ?? 0,
    };
  }

  async getMyBlogEngagement(slug: string, userId: string) {
    const blog = await this.findPublishedBlog(slug);

    const [isLiked, isSaved] = await Promise.all([
      this.prisma.blogLike
        .findUnique({ where: { uq_blog_likes_user_blog: { userId, blogId: blog.id } } })
        .then((r) => r !== null),
      this.prisma.blogSave
        .findUnique({ where: { uq_blog_saves_user_blog: { userId, blogId: blog.id } } })
        .then((r) => r !== null),
    ]);

    return { isLiked, isSaved };
  }

  // ── Saved articles ────────────────────────────────────────────────────────────

  async getMySavedBlogs(userId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;

    const [saves, total] = await Promise.all([
      this.prisma.blogSave.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: { blogId: true },
      }),
      this.prisma.blogSave.count({ where: { userId } }),
    ]);

    const blogIds = saves.map((s) => s.blogId);
    const blogs = await Promise.all(blogIds.map((id) => this.blogsRepo.findById(id)));
    const entities = blogs.filter(Boolean).map((b) => toBlogSummaryEntity(b!));

    return { data: entities, total, page, limit };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  private async findPublishedBlog(slug: string) {
    const blog = await this.prisma.blog.findUnique({ where: { slug } });
    if (!blog || blog.status !== BlogStatus.published) {
      throw new NotFoundException('Blog not found or not published.');
    }
    return blog;
  }
}
