import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '@common/decorators/current-user.decorator';
import { Public } from '@common/decorators/public.decorator';
import { JwtUser } from '@modules/auth/types/jwt-user.type';

import { CreateBlogDto } from '../dto/create-blog.dto';
import { ScheduleBlogDto } from '../dto/schedule-blog.dto';
import { UpdateBlogDto } from '../dto/update-blog.dto';
import { BlogSummaryEntity } from '../entities/blog-summary.entity';
import { BlogEntity } from '../entities/blog.entity';
import { BlogsService } from '../services/blogs.service';

@ApiTags('blogs')
@Controller({ path: 'blogs', version: '1' })
export class BlogsController {
  constructor(private readonly blogsService: BlogsService) {}

  @Post()
  @ApiBearerAuth()
  @ApiOkResponse({ type: BlogEntity, description: 'Creates a draft blog.' })
  create(@Body() dto: CreateBlogDto, @CurrentUser() user: JwtUser): Promise<BlogEntity> {
    return this.blogsService.create(dto, user);
  }

  // Static routes MUST appear before /:slug to prevent shadowing
  @Get('me')
  @ApiBearerAuth()
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOkResponse({ description: "Returns the authenticated user's paginated blogs (summaries, no body)." })
  myBlogs(
    @CurrentUser() user: JwtUser,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.blogsService.findMyBlogs(user.sub, +page, +limit);
  }

  @Get('me/stats')
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Returns blog counts by status for the authenticated user.' })
  myStats(@CurrentUser() user: JwtUser) {
    return this.blogsService.getMyStats(user.sub);
  }

  @Get('me/:slug')
  @ApiBearerAuth()
  @ApiOkResponse({ type: BlogEntity, description: "Returns a single blog by slug — any status — if it belongs to the authenticated user. Includes full body, seoTitleOverride, seoDescOverride." })
  myBlogBySlug(@Param('slug') slug: string, @CurrentUser() user: JwtUser): Promise<BlogEntity> {
    return this.blogsService.findMyBlogBySlug(slug, user.sub);
  }

  @Get(':slug')
  @Public()
  @ApiOkResponse({ type: BlogEntity, description: 'Returns a published blog by slug.' })
  findOne(@Param('slug') slug: string): Promise<BlogEntity> {
    return this.blogsService.findPublic(slug);
  }

  @Patch(':slug')
  @ApiBearerAuth()
  @ApiOkResponse({ type: BlogEntity, description: 'Updates a blog. Author or company owner only.' })
  update(
    @Param('slug') slug: string,
    @Body() dto: UpdateBlogDto,
    @CurrentUser() user: JwtUser,
  ): Promise<BlogEntity> {
    return this.blogsService.update(slug, dto, user);
  }

  @Delete(':slug')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOkResponse({ description: 'Deletes a draft blog permanently.' })
  delete(@Param('slug') slug: string, @CurrentUser() user: JwtUser): Promise<void> {
    return this.blogsService.delete(slug, user);
  }

  // ── Status transitions ────────────────────────────────────────────────────────

  @Post(':slug/publish')
  @ApiBearerAuth()
  @ApiOkResponse({ type: BlogEntity, description: 'Publishes a draft or scheduled blog.' })
  publish(@Param('slug') slug: string, @CurrentUser() user: JwtUser): Promise<BlogEntity> {
    return this.blogsService.publish(slug, user);
  }

  @Post(':slug/schedule')
  @ApiBearerAuth()
  @ApiOkResponse({ type: BlogEntity, description: 'Schedules a blog for future publishing.' })
  schedule(
    @Param('slug') slug: string,
    @Body() dto: ScheduleBlogDto,
    @CurrentUser() user: JwtUser,
  ): Promise<BlogEntity> {
    return this.blogsService.schedule(slug, dto, user);
  }

  @Post(':slug/archive')
  @ApiBearerAuth()
  @ApiOkResponse({ type: BlogEntity, description: 'Archives a published blog.' })
  archive(@Param('slug') slug: string, @CurrentUser() user: JwtUser): Promise<BlogEntity> {
    return this.blogsService.archive(slug, user);
  }

  @Post(':slug/unarchive')
  @ApiBearerAuth()
  @ApiOkResponse({ type: BlogEntity, description: 'Restores an archived blog to published.' })
  unarchive(@Param('slug') slug: string, @CurrentUser() user: JwtUser): Promise<BlogEntity> {
    return this.blogsService.unarchive(slug, user);
  }
}
