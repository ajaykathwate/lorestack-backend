import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';

import { Public } from '@common/decorators/public.decorator';
import { PaginatedResponse } from '@common/dto/paginated-response.dto';
import { BlogSummaryEntity } from '@modules/blogs/entities/blog-summary.entity';
import { toBlogSummaryEntity } from '@modules/blogs/mappers/blog.mappers';
import { BlogsRepository } from '@modules/blogs/repositories/blogs.repository';

import { ExploreQueryDto } from '../dto/explore-query.dto';
import { DiscoveryService } from '../services/discovery.service';

@ApiTags('discovery')
@Public()
@Controller({ version: '1' })
export class DiscoveryController {
  constructor(
    private readonly blogsRepo: BlogsRepository,
    private readonly discoveryService: DiscoveryService,
  ) {}

  @Get('home')
  @ApiOkResponse({ description: 'Aggregated homepage payload: featured article, trending, deep dives, tags, and quick stats.' })
  getHome() {
    return this.discoveryService.getHome();
  }

  @Get('stats')
  @ApiOkResponse({ description: 'Platform-level publishing and engagement statistics.' })
  getStats() {
    return this.discoveryService.getStats();
  }

  @Get('article-types')
  @ApiOkResponse({ description: 'All available article types with human-readable labels and descriptions.' })
  getArticleTypes() {
    return this.discoveryService.getArticleTypes();
  }

  @Get('explore')
  @ApiOkResponse({ description: 'Paginated published blogs with optional filters.' })
  async explore(@Query() query: ExploreQueryDto): Promise<PaginatedResponse<BlogSummaryEntity>> {
    const since = this.resolveSince(query.dateRange);
    const skip = (query.page - 1) * query.limit;
    const filters = {
      articleType: query.type,
      tagSlug: query.tag,
      companyId: query.companyId,
      since,
    };

    const [blogs, total] = await Promise.all([
      this.blogsRepo.findPublished({ ...filters, skip, take: query.limit, sort: query.sort }),
      this.blogsRepo.countPublished(filters),
    ]);

    return new PaginatedResponse(blogs.map(toBlogSummaryEntity), total, query.page, query.limit);
  }

  @Get('explore/trending')
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOkResponse({ type: BlogSummaryEntity, isArray: true, description: 'Top trending blogs ranked by engagement score.' })
  async trending(@Query('limit') limit = 5): Promise<BlogSummaryEntity[]> {
    const blogs = await this.blogsRepo.findTrending(+limit);
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
