import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BlogStatus } from '@prisma/client';

import { TagsRepository } from '@modules/tags/repositories/tags.repository';

import { BlogsRepository } from '../repositories/blogs.repository';

@Injectable()
export class BlogSchedulerService {
  private readonly logger = new Logger(BlogSchedulerService.name);

  constructor(
    private readonly blogsRepo: BlogsRepository,
    private readonly tagsRepo: TagsRepository,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async publishDueBlogs(): Promise<void> {
    const due = await this.blogsRepo.findDueScheduled();
    if (!due.length) return;

    this.logger.log(`Scheduler: found ${due.length} blog(s) due for publishing`);

    for (const blog of due) {
      try {
        await this.blogsRepo.update(blog.id, {
          status: BlogStatus.published,
          publishedAt: new Date(),
          scheduledAt: null,
          scheduledTimezone: null,
        });

        for (const blogTag of blog.tags) {
          await this.tagsRepo.incrementBlogCount(blogTag.tagId);
        }

        this.logger.log(`Scheduler: published blog "${blog.slug}"`);
      } catch (error) {
        // Mark as failed so the author can see it in the dashboard and republish manually
        try {
          await this.blogsRepo.update(blog.id, { status: BlogStatus.publish_failed });
        } catch {
          // If even the failure update fails, just log — don't crash the cron job
        }
        this.logger.error(
          `Scheduler: failed to publish blog "${blog.slug}"`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
  }
}
