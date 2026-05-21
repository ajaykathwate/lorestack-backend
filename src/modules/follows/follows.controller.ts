import { Controller, Delete, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '@common/decorators/current-user.decorator';
import { JwtUser } from '@modules/auth/types/jwt-user.type';

import { FollowsService } from './follows.service';

@ApiTags('follows')
@ApiBearerAuth()
@Controller({ version: '1' })
export class FollowsController {
  constructor(private readonly followsService: FollowsService) {}

  @Post('author-profiles/:id/follow')
  @ApiOkResponse({ description: 'Follow an author. Returns updated followersCount.' })
  followAuthor(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.followsService.followAuthor(user.sub, id);
  }

  @Delete('author-profiles/:id/follow')
  @ApiOkResponse({ description: 'Unfollow an author. Returns updated followersCount.' })
  unfollowAuthor(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.followsService.unfollowAuthor(user.sub, id);
  }

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
}
