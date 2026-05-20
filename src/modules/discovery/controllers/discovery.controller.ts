import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { Public } from '@common/decorators/public.decorator';
import { BlogSummaryEntity } from '@modules/blogs/entities/blog-summary.entity';
import { toBlogSummaryEntity } from '@modules/blogs/mappers/blog.mappers';
import { BlogsRepository } from '@modules/blogs/repositories/blogs.repository';

import { ExploreQueryDto } from '../dto/explore-query.dto';

@ApiTags('discovery')
@Public()
@Controller({ version: '1' })
export class DiscoveryController {
  constructor(private readonly blogsRepo: BlogsRepository) {}

  @Get('explore')
  @ApiOkResponse({ type: BlogSummaryEntity, isArray: true, description: 'Paginated published blogs with optional filters.' })
  async explore(@Query() query: ExploreQueryDto): Promise<BlogSummaryEntity[]> {
    const since = this.resolveSince(query.dateRange);
    const skip = (query.page - 1) * query.limit;

    const blogs = await this.blogsRepo.findPublished({
      articleType: query.type,
      tagSlug: query.tag,
      companyId: query.companyId,
      since,
      skip,
      take: query.limit,
    });

    return blogs.map(toBlogSummaryEntity);
  }

  private resolveSince(range?: string): Date | undefined {
    const now = new Date();
    switch (range) {
      case 'week':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case 'month':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case '6months':
        return new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
      default:
        return undefined;
    }
  }
}
