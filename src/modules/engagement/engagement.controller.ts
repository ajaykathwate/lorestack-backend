import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';

import { CurrentUser } from '@common/decorators/current-user.decorator';
import { Public } from '@common/decorators/public.decorator';
import { JwtUser } from '@modules/auth/types/jwt-user.type';

import { ReadProgressDto } from './dto/read-progress.dto';
import { ShareBlogDto } from './dto/share-blog.dto';
import { EngagementService } from './engagement.service';

@ApiTags('engagement')
@Controller({ version: '1' })
export class EngagementController {
  constructor(private readonly engagementService: EngagementService) {}

  // ── Likes ─────────────────────────────────────────────────────────────────────

  @Post('blogs/:slug/like')
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Like a blog. Returns updated likesCount.' })
  likeBlog(@Param('slug') slug: string, @CurrentUser() user: JwtUser) {
    return this.engagementService.likeBlog(slug, user.sub);
  }

  @Delete('blogs/:slug/like')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Unlike a blog. Returns updated likesCount.' })
  unlikeBlog(@Param('slug') slug: string, @CurrentUser() user: JwtUser) {
    return this.engagementService.unlikeBlog(slug, user.sub);
  }

  // ── Saves ─────────────────────────────────────────────────────────────────────

  @Post('blogs/:slug/save')
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Save/bookmark a blog. Returns updated savesCount.' })
  saveBlog(@Param('slug') slug: string, @CurrentUser() user: JwtUser) {
    return this.engagementService.saveBlog(slug, user.sub);
  }

  @Delete('blogs/:slug/save')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Remove a saved blog. Returns updated savesCount.' })
  unsaveBlog(@Param('slug') slug: string, @CurrentUser() user: JwtUser) {
    return this.engagementService.unsaveBlog(slug, user.sub);
  }

  // ── Shares ────────────────────────────────────────────────────────────────────

  @Post('blogs/:slug/share')
  @Public()
  @ApiOkResponse({ description: 'Record a share event. Auth optional — pass token to attribute share to user.' })
  shareBlog(
    @Param('slug') slug: string,
    @Body() dto: ShareBlogDto,
    @Req() req: Request,
  ) {
    const user = (req as any).user as JwtUser | undefined;
    return this.engagementService.shareBlog(slug, dto, user?.sub);
  }

  // ── Read sessions ─────────────────────────────────────────────────────────────

  @Post('blogs/:slug/read-session')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Upsert a read session (scroll depth + duration). Call periodically while reading.' })
  upsertReadSession(
    @Param('slug') slug: string,
    @Body() dto: ReadProgressDto,
    @Req() req: Request,
  ) {
    const user = (req as any).user as JwtUser | undefined;
    return this.engagementService.upsertReadSession(slug, dto, user?.sub);
  }

  // ── Engagement summary ────────────────────────────────────────────────────────

  @Get('blogs/:slug/engagement')
  @Public()
  @ApiOkResponse({ description: 'Get engagement counters for a blog (views, likes, saves, shares, completion rate).' })
  getBlogEngagement(@Param('slug') slug: string) {
    return this.engagementService.getBlogEngagement(slug);
  }

  @Get('blogs/:slug/my-engagement')
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Get current user engagement status for a blog (isLiked, isSaved).' })
  getMyBlogEngagement(@Param('slug') slug: string, @CurrentUser() user: JwtUser) {
    return this.engagementService.getMyBlogEngagement(slug, user.sub);
  }
}
