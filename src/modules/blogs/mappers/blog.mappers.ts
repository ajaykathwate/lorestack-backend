import { TagEntity } from '@modules/tags/entities/tag.entity';

import { BlogSummaryEntity } from '../entities/blog-summary.entity';
import { BlogEntity } from '../entities/blog.entity';
import { BlogWithTags } from '../repositories/blogs.repository';

export function toBlogEntity(blog: BlogWithTags): BlogEntity {
  const tags = blog.tags.map((bt) => new TagEntity(bt.tag));
  return new BlogEntity({ ...blog, tags });
}

export function toBlogSummaryEntity(blog: BlogWithTags): BlogSummaryEntity {
  const tags = blog.tags.map((bt) => new TagEntity(bt.tag));
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { body: _body, seoTitleOverride: _s1, seoDescOverride: _s2, ...rest } = blog;
  return new BlogSummaryEntity({ ...rest, tags });
}
