import { Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { PlatformRole } from '@prisma/client';

import { Public } from '@common/decorators/public.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { RolesGuard } from '@common/guards/roles.guard';

import { TagEntity } from '../entities/tag.entity';
import { TagsService } from '../services/tags.service';

@ApiTags('tags')
@Controller({ path: 'tags', version: '1' })
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Get()
  @Public()
  @ApiOkResponse({ type: TagEntity, isArray: true })
  findAll(): Promise<TagEntity[]> {
    return this.tagsService.findAll();
  }

  // Static route must appear before /:slug to prevent shadowing
  @Get('trending')
  @Public()
  @ApiOkResponse({ type: TagEntity, isArray: true, description: 'Top 10 approved tags by blog count.' })
  trending(): Promise<TagEntity[]> {
    return this.tagsService.findTrending();
  }

  @Get(':slug')
  @Public()
  @ApiOkResponse({ type: TagEntity })
  findBySlug(@Param('slug') slug: string): Promise<TagEntity> {
    return this.tagsService.findBySlug(slug);
  }

  @Post(':id/approve')
  @UseGuards(RolesGuard)
  @Roles(PlatformRole.platform_admin)
  @ApiBearerAuth()
  @ApiOkResponse({ type: TagEntity, description: 'Approves a tag so it appears in autocomplete. Admin only.' })
  approve(@Param('id', ParseUUIDPipe) id: string): Promise<TagEntity> {
    return this.tagsService.approve(id);
  }
}
