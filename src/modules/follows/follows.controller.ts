import { Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '@common/decorators/current-user.decorator';
import { JwtUser } from '@modules/auth/types/jwt-user.type';

import { FollowsService } from './follows.service';

@ApiTags('follows')
@ApiBearerAuth()
@Controller({ version: '1' })
export class FollowsController {
  constructor(private readonly followsService: FollowsService) {}

  // ── My followers ─────────────────────────────────────────────────────────────

  @Get('me/followers/authors')
  @ApiOkResponse({ description: 'Returns author profiles of users who follow the authenticated user.' })
  getMyFollowers(@CurrentUser() user: JwtUser) {
    return this.followsService.getMyFollowers(user.sub);
  }

  // ── My following lists ────────────────────────────────────────────────────────

  @Get('me/following/authors')
  @ApiOkResponse({ description: 'Returns author profiles the authenticated user follows.' })
  getFollowingAuthors(@CurrentUser() user: JwtUser) {
    return this.followsService.getFollowingAuthors(user.sub);
  }

  @Get('me/following/companies')
  @ApiOkResponse({ description: 'Returns companies the authenticated user follows.' })
  getFollowingCompanies(@CurrentUser() user: JwtUser) {
    return this.followsService.getFollowingCompanies(user.sub);
  }

  @Get('me/following/tags')
  @ApiOkResponse({ description: 'Returns tags the authenticated user follows.' })
  getFollowingTags(@CurrentUser() user: JwtUser) {
    return this.followsService.getFollowingTags(user.sub);
  }

  // ── Author follows ────────────────────────────────────────────────────────────

  @Post('author-profiles/:id/follow')
  @ApiOkResponse({ description: 'Follow an author. Returns updated followersCount.' })
  followAuthor(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.followsService.followAuthor(user.sub, id);
  }

  @Delete('author-profiles/:id/follow')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Unfollow an author. Returns updated followersCount.' })
  unfollowAuthor(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.followsService.unfollowAuthor(user.sub, id);
  }

  // ── Company follows ───────────────────────────────────────────────────────────

  @Post('companies/:id/follow')
  @ApiOkResponse({ description: 'Follow a company. Returns updated followersCount.' })
  followCompany(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.followsService.followCompany(user.sub, id);
  }

  @Delete('companies/:id/follow')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Unfollow a company. Returns updated followersCount.' })
  unfollowCompany(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.followsService.unfollowCompany(user.sub, id);
  }

  // ── Tag follows ───────────────────────────────────────────────────────────────

  @Post('tags/:id/follow')
  @ApiOkResponse({ description: 'Follow a tag. Returns updated followersCount.' })
  followTag(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.followsService.followTag(user.sub, id);
  }

  @Delete('tags/:id/follow')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Unfollow a tag. Returns updated followersCount.' })
  unfollowTag(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.followsService.unfollowTag(user.sub, id);
  }
}
