import { TagEntity } from '@modules/tags/entities/tag.entity';

import { BlogSummaryEntity } from '../entities/blog-summary.entity';
import { BlogEntity, EmbeddedAuthorProfile, EmbeddedCompany } from '../entities/blog.entity';
import { BlogWithTags } from '../repositories/blogs.repository';

export function toBlogEntity(blog: BlogWithTags): BlogEntity {
  const tags = blog.tags.map((bt) => new TagEntity(bt.tag));
  const authorProfile = blog.author?.authorProfile
    ? new EmbeddedAuthorProfile({
        displayName: blog.author.authorProfile.displayName,
        username: blog.author.authorProfile.username,
        avatarUrl: blog.author.authorProfile.avatarUrl,
      })
    : null;
  const company = blog.company
    ? new EmbeddedCompany({
        name: blog.company.name,
        handle: blog.company.handle,
        logoUrl: blog.company.logoUrl,
      })
    : null;
  return new BlogEntity({ ...blog, tags, authorProfile, company });
}

export function toBlogSummaryEntity(blog: BlogWithTags): BlogSummaryEntity {
  const tags = blog.tags.map((bt) => new TagEntity(bt.tag));
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { body: _body, seoTitleOverride: _s1, seoDescOverride: _s2, author: _a, company: _c, engagementCounters: _e, ...rest } = blog;
  const authorProfile = blog.author?.authorProfile
    ? new EmbeddedAuthorProfile({
        displayName: blog.author.authorProfile.displayName,
        username: blog.author.authorProfile.username,
        avatarUrl: blog.author.authorProfile.avatarUrl,
      })
    : null;
  const company = blog.company
    ? new EmbeddedCompany({ name: blog.company.name, handle: blog.company.handle, logoUrl: blog.company.logoUrl })
    : null;
  const likesCount = (_e as { likes: number } | null)?.likes ?? 0;
  const savesCount = (_e as { saves: number } | null)?.saves ?? 0;
  const viewsCount = (_e as { totalViews: number } | null)?.totalViews ?? 0;
  return new BlogSummaryEntity({ ...rest, tags, authorProfile, company, likesCount, savesCount, viewsCount });
}
