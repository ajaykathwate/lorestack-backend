import { Injectable } from '@nestjs/common';
import { ArticleType } from '@prisma/client';

import { PrismaService } from '@database/prisma/prisma.service';
import { toBlogSummaryEntity } from '@modules/blogs/mappers/blog.mappers';
import { BlogsRepository } from '@modules/blogs/repositories/blogs.repository';
import { TagEntity } from '@modules/tags/entities/tag.entity';

const ARTICLE_TYPE_META: Record<ArticleType, { label: string; description: string }> = {
  engineering_blog: {
    label: 'Engineering Blog',
    description: 'General engineering articles covering tools, practices, and day-to-day technical work.',
  },
  architecture_deep_dive: {
    label: 'Architecture Deep Dive',
    description: 'In-depth exploration of system design decisions, trade-offs, and architectural patterns.',
  },
  case_study: {
    label: 'Case Study',
    description: 'Real-world problem → solution narratives with measurable outcomes.',
  },
  scaling_story: {
    label: 'Scaling Story',
    description: 'How a system or team was grown to handle increased load, users, or complexity.',
  },
  failure_postmortem: {
    label: 'Failure Postmortem',
    description: 'Honest retrospectives on incidents, outages, or failed experiments — and what was learned.',
  },
  ai_experiment: {
    label: 'AI Experiment',
    description: 'Hands-on exploration of AI/ML models, integrations, or applied research.',
  },
  founder_note: {
    label: "Founder's Note",
    description: 'Perspective from company leadership on product direction, culture, or lessons learned.',
  },
  tutorial: {
    label: 'Tutorial',
    description: 'Step-by-step guide to accomplish a specific technical task.',
  },
  opinion_essay: {
    label: 'Opinion Essay',
    description: 'Argued perspective on a technical or industry topic — not neutral, not a how-to.',
  },
  project_showcase: {
    label: 'Project Showcase',
    description: 'Demonstration of a built product, open-source library, or internal tool.',
  },
  open_source_release: {
    label: 'Open Source Release',
    description: 'Announcement and walkthrough of a newly open-sourced project.',
  },
  other: {
    label: 'Other',
    description: 'Articles that do not fit a predefined type.',
  },
};

@Injectable()
export class DiscoveryService {
  constructor(
    private readonly blogsRepo: BlogsRepository,
    private readonly prisma: PrismaService,
  ) {}

  async getHome() {
    const [leadArticle, trending, deepDives, topTags, weekStart] = await Promise.all([
      this.blogsRepo.findLeadArticle(),
      this.blogsRepo.findTrending(6),
      this.blogsRepo.findDeepDives(5),
      this.prisma.tag.findMany({ where: { isApproved: true }, orderBy: { blogCount: 'desc' }, take: 10 }),
      Promise.resolve(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)),
    ]);

    const featuredArticle = leadArticle ? toBlogSummaryEntity(leadArticle) : null;

    // Exclude the featured article from trending list
    const trendingArticles = trending
      .filter((b) => b.id !== leadArticle?.id)
      .slice(0, 5)
      .map(toBlogSummaryEntity);

    const recentDeepDives = deepDives.map(toBlogSummaryEntity);
    const trendingTags = topTags.map((t) => new TagEntity(t));

    const [totalPublishedArticles, articlesPublishedThisWeek, companiesActivelyPublishing] = await Promise.all([
      this.prisma.blog.count({ where: { status: 'published' } }),
      this.prisma.blog.count({ where: { status: 'published', publishedAt: { gte: weekStart } } }),
      this.prisma.company.count({
        where: { blogs: { some: { status: 'published', publishedAt: { gte: weekStart } } } },
      }),
    ]);

    return {
      featuredArticle,
      trendingArticles,
      recentDeepDives,
      trendingTags,
      stats: { totalPublishedArticles, articlesPublishedThisWeek, companiesActivelyPublishing },
    };
  }

  async getStats() {
    const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalPublishedArticles,
      articlesPublishedThisWeek,
      newDeepDivesThisWeek,
      companiesActivelyPublishing,
      totalAuthors,
      avgCompletionResult,
    ] = await Promise.all([
      this.prisma.blog.count({ where: { status: 'published' } }),
      this.prisma.blog.count({ where: { status: 'published', publishedAt: { gte: weekStart } } }),
      this.prisma.blog.count({
        where: { status: 'published', articleType: 'architecture_deep_dive', publishedAt: { gte: weekStart } },
      }),
      this.prisma.company.count({
        where: { blogs: { some: { status: 'published', publishedAt: { gte: weekStart } } } },
      }),
      this.prisma.authorProfile.count(),
      this.prisma.blogEngagementCounters.aggregate({ _avg: { avgCompletionRate: true } }),
    ]);

    const avgReadCompletion = Math.round((avgCompletionResult._avg.avgCompletionRate ?? 0) * 100) / 100;

    return {
      totalPublishedArticles,
      articlesPublishedThisWeek,
      newDeepDivesThisWeek,
      avgReadCompletion,
      companiesActivelyPublishing,
      totalAuthors,
    };
  }

  getArticleTypes() {
    return Object.entries(ARTICLE_TYPE_META).map(([type, meta]) => ({
      type: type as ArticleType,
      label: meta.label,
      description: meta.description,
    }));
  }
}
