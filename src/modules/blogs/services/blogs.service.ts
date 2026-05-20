import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { BlogStatus } from '@prisma/client';

import { permissionChecker } from '@common/permissions/permission-checker';
import { mapPrismaError } from '@database/prisma/prisma.exceptions';
import { JwtUser } from '@modules/auth/types/jwt-user.type';
import { CompaniesRepository } from '@modules/companies/repositories/companies.repository';
import { TagEntity } from '@modules/tags/entities/tag.entity';
import { TagsRepository } from '@modules/tags/repositories/tags.repository';
import { TagsService } from '@modules/tags/services/tags.service';

import { CreateBlogDto } from '../dto/create-blog.dto';
import { ScheduleBlogDto } from '../dto/schedule-blog.dto';
import { UpdateBlogDto } from '../dto/update-blog.dto';
import { BlogEntity } from '../entities/blog.entity';
import { BlogWithTags, BlogsRepository } from '../repositories/blogs.repository';

@Injectable()
export class BlogsService {
  constructor(
    private readonly repo: BlogsRepository,
    private readonly tagsService: TagsService,
    private readonly tagsRepo: TagsRepository,
    @Inject(forwardRef(() => CompaniesRepository))
    private readonly companiesRepo: CompaniesRepository,
  ) {}

  // ── CRUD ──────────────────────────────────────────────────────────────────────

  async create(dto: CreateBlogDto, requester: JwtUser): Promise<BlogEntity> {
    if (dto.companyId) {
      await this.assertCompanyMembership(dto.companyId, requester);
    }

    const tags = dto.tags?.length ? await this.tagsService.resolveOrCreateTags(dto.tags) : [];
    const slug = await this.generateSlug(dto.title);
    const ogImageUrl = this.buildDefaultOgUrl(dto.title);

    try {
      const blog = await this.repo.create({
        title: dto.title,
        slug,
        body: dto.body ?? '',
        articleType: dto.articleType,
        ogImageUrl: dto.coverImageUrl ?? ogImageUrl,
        summary: dto.summary,
        coverImageUrl: dto.coverImageUrl,
        seoTitleOverride: dto.seoTitleOverride,
        seoDescOverride: dto.seoDescOverride,
        status: BlogStatus.draft,
        author: { connect: { id: requester.sub } },
        ...(dto.companyId ? { company: { connect: { id: dto.companyId } } } : {}),
        tags: {
          create: tags.map((t) => ({ tag: { connect: { id: t.id } } })),
        },
      });
      return this.toEntity(blog);
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async findOne(slug: string): Promise<BlogEntity> {
    const blog = await this.repo.findBySlug(slug);
    if (!blog) throw new NotFoundException('Blog not found.');
    return this.toEntity(blog);
  }

  async findPublic(slug: string): Promise<BlogEntity> {
    const blog = await this.repo.findBySlug(slug);
    if (!blog || blog.status !== BlogStatus.published) {
      throw new NotFoundException('Blog not found or not published.');
    }
    return this.toEntity(blog);
  }

  async findMyBlogs(userId: string): Promise<BlogEntity[]> {
    const blogs = await this.repo.findByAuthor(userId);
    return blogs.map((b) => this.toEntity(b));
  }

  async update(slug: string, dto: UpdateBlogDto, requester: JwtUser): Promise<BlogEntity> {
    const blog = await this.getAndAuthorize(slug, requester, 'edit');

    let newSlug: string | undefined;
    if (dto.title && dto.title !== blog.title && blog.status === BlogStatus.draft) {
      newSlug = await this.generateSlug(dto.title);
    }

    let tagIds: string[] | undefined;
    if (dto.tags !== undefined) {
      const resolvedTags = dto.tags.length
        ? await this.tagsService.resolveOrCreateTags(dto.tags)
        : [];
      tagIds = resolvedTags.map((t) => t.id);
    }

    if (tagIds !== undefined) {
      await this.repo.replaceTags(blog.id, tagIds);
    }

    try {
      const updated = await this.repo.update(blog.id, {
        ...(dto.title ? { title: dto.title } : {}),
        ...(newSlug ? { slug: newSlug } : {}),
        ...(dto.body !== undefined ? { body: dto.body } : {}),
        ...(dto.articleType ? { articleType: dto.articleType } : {}),
        ...(dto.summary !== undefined ? { summary: dto.summary } : {}),
        ...(dto.coverImageUrl !== undefined ? { coverImageUrl: dto.coverImageUrl } : {}),
        ...(dto.seoTitleOverride !== undefined ? { seoTitleOverride: dto.seoTitleOverride } : {}),
        ...(dto.seoDescOverride !== undefined ? { seoDescOverride: dto.seoDescOverride } : {}),
      });
      return this.toEntity(updated);
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async delete(slug: string, requester: JwtUser): Promise<void> {
    const blog = await this.repo.findBySlug(slug);
    if (!blog) throw new NotFoundException('Blog not found.');

    if (blog.authorId !== requester.sub) {
      throw new ForbiddenException('You can only delete your own drafts.');
    }

    if (blog.status !== BlogStatus.draft) {
      throw new BadRequestException('Only drafts can be deleted. Archive the blog instead.');
    }

    await this.repo.delete(blog.id);
  }

  // ── Status transitions ────────────────────────────────────────────────────────

  async publish(slug: string, requester: JwtUser): Promise<BlogEntity> {
    const blog = await this.getAndAuthorize(slug, requester, 'edit');

    if (blog.status === BlogStatus.published) {
      throw new BadRequestException('Blog is already published.');
    }
    if (!blog.title?.trim()) {
      throw new BadRequestException('Blog must have a title before publishing.');
    }

    const updated = await this.repo.update(blog.id, {
      status: BlogStatus.published,
      publishedAt: new Date(),
      scheduledAt: null,
      scheduledTimezone: null,
    });

    // Update tag counts for all attached tags
    for (const blogTag of updated.tags) {
      await this.tagsRepo.incrementBlogCount(blogTag.tagId);
    }

    return this.toEntity(updated);
  }

  async schedule(slug: string, dto: ScheduleBlogDto, requester: JwtUser): Promise<BlogEntity> {
    const blog = await this.getAndAuthorize(slug, requester, 'edit');

    if (blog.status === BlogStatus.published) {
      throw new BadRequestException('Blog is already published. Archive it first to reschedule.');
    }
    if (!blog.title?.trim()) {
      throw new BadRequestException('Blog must have a title before scheduling.');
    }

    const updated = await this.repo.update(blog.id, {
      status: BlogStatus.scheduled,
      scheduledAt: dto.scheduledAt,
      scheduledTimezone: dto.scheduledTimezone ?? 'UTC',
    });
    return this.toEntity(updated);
  }

  async archive(slug: string, requester: JwtUser): Promise<BlogEntity> {
    const blog = await this.getAndAuthorize(slug, requester, 'archive');

    if (blog.status === BlogStatus.archived) {
      throw new BadRequestException('Blog is already archived.');
    }
    if (blog.status === BlogStatus.draft) {
      throw new BadRequestException('Drafts cannot be archived. Delete them instead.');
    }

    const updated = await this.repo.update(blog.id, { status: BlogStatus.archived });

    // Decrement tag counts
    if (blog.status === BlogStatus.published) {
      for (const blogTag of (updated as BlogWithTags).tags) {
        await this.tagsRepo.decrementBlogCount(blogTag.tagId);
      }
    }

    return this.toEntity(updated);
  }

  async unarchive(slug: string, requester: JwtUser): Promise<BlogEntity> {
    const blog = await this.getAndAuthorize(slug, requester, 'edit');

    if (blog.status !== BlogStatus.archived) {
      throw new BadRequestException('Only archived blogs can be unarchived.');
    }

    const updated = await this.repo.update(blog.id, {
      status: BlogStatus.published,
      publishedAt: blog.publishedAt ?? new Date(),
    });

    // Re-increment tag counts
    for (const blogTag of (updated as BlogWithTags).tags) {
      await this.tagsRepo.incrementBlogCount(blogTag.tagId);
    }

    return this.toEntity(updated);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  private async getAndAuthorize(
    slug: string,
    requester: JwtUser,
    action: 'edit' | 'archive',
  ): Promise<BlogWithTags> {
    const blog = await this.repo.findBySlug(slug);
    if (!blog) throw new NotFoundException('Blog not found.');

    const isAuthor = blog.authorId === requester.sub;
    if (isAuthor) return blog;

    // Company owner can edit/archive any company blog
    if (blog.companyId) {
      const membership = await this.companiesRepo.findMembership(blog.companyId, requester.sub);
      const companyRole = membership?.role ?? null;

      const allowed =
        action === 'edit'
          ? permissionChecker.canEditAnyCompanyBlog(requester.platformRole, companyRole)
          : permissionChecker.canArchiveAnyCompanyBlog(requester.platformRole, companyRole);

      if (allowed) return blog;
    }

    throw new ForbiddenException('You do not have permission to modify this blog.');
  }

  private async assertCompanyMembership(companyId: string, requester: JwtUser): Promise<void> {
    const company = await this.companiesRepo.findById(companyId);
    if (!company) throw new NotFoundException('Company not found.');

    const membership = await this.companiesRepo.findMembership(companyId, requester.sub);
    const companyRole = membership?.role ?? null;

    if (!permissionChecker.canPublishUnderCompany(requester.platformRole, companyRole)) {
      throw new ForbiddenException('You are not a member of this company.');
    }
  }

  private async generateSlug(title: string): Promise<string> {
    const base = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 180);

    let slug = base;
    let attempt = 0;

    while (await this.repo.slugExists(slug)) {
      attempt++;
      slug = `${base}-${attempt}`;
    }

    return slug;
  }

  private buildDefaultOgUrl(title: string): string {
    // Placeholder — in production this would point to an auto-generated OG image
    const encoded = encodeURIComponent(title.substring(0, 60));
    return `https://og.lorestack.io/blog?title=${encoded}`;
  }

  private toEntity(blog: BlogWithTags): BlogEntity {
    const tags = blog.tags.map((bt) => new TagEntity(bt.tag));
    return new BlogEntity({ ...blog, tags });
  }
}
