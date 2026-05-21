import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '@common/decorators/current-user.decorator';
import { Public } from '@common/decorators/public.decorator';
import { JwtUser } from '@modules/auth/types/jwt-user.type';

import { UpdateAuthorProfileDto } from '../dto/update-author-profile.dto';
import { AuthorProfileEntity } from '../entities/author-profile.entity';
import { AuthorProfilesService } from '../services/author-profiles.service';

@ApiTags('author-profiles')
@Controller({ path: 'author-profiles', version: '1' })
export class AuthorProfilesController {
  constructor(private readonly authorProfilesService: AuthorProfilesService) {}

  @Get('me')
  @ApiBearerAuth()
  @ApiOkResponse({ type: AuthorProfileEntity })
  getMe(@CurrentUser() user: JwtUser): Promise<AuthorProfileEntity> {
    return this.authorProfilesService.findMe(user.sub);
  }

  @Patch('me')
  @ApiBearerAuth()
  @ApiOkResponse({ type: AuthorProfileEntity })
  updateMe(
    @CurrentUser() user: JwtUser,
    @Body() dto: UpdateAuthorProfileDto,
  ): Promise<AuthorProfileEntity> {
    return this.authorProfilesService.updateMe(user.sub, dto);
  }

  // Static routes before /:username to avoid shadowing
  @Get('by-id/:id')
  @Public()
  @ApiOkResponse({ type: AuthorProfileEntity })
  findById(@Param('id') id: string): Promise<AuthorProfileEntity> {
    return this.authorProfilesService.findById(id);
  }

  @Get(':username/blogs')
  @Public()
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'sort', required: false, enum: ['newest', 'oldest'] })
  @ApiOkResponse({ description: "Returns an author's paginated published blogs." })
  getAuthorBlogs(
    @Param('username') username: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('sort') sort: 'newest' | 'oldest' = 'newest',
  ) {
    return this.authorProfilesService.findPublishedBlogs(username, +page, +limit, sort);
  }

  @Get(':username')
  @Public()
  @ApiOkResponse({ type: AuthorProfileEntity })
  findByUsername(@Param('username') username: string): Promise<AuthorProfileEntity> {
    return this.authorProfilesService.findByUsername(username);
  }
}
