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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '@common/decorators/current-user.decorator';
import { Public } from '@common/decorators/public.decorator';
import { JwtUser } from '@modules/auth/types/jwt-user.type';

import { BlogEntity } from '@modules/blogs/entities/blog.entity';

import { CreateCompanyDto } from '../dto/create-company.dto';
import { CreateMilestoneDto } from '../dto/create-milestone.dto';
import { InviteAuthorDto } from '../dto/invite-author.dto';
import { UpdateCompanyDto } from '../dto/update-company.dto';
import { CompaniesService } from '../services/companies.service';

@ApiTags('companies')
@Controller({ path: 'companies', version: '1' })
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Post()
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Creates a company and assigns the creator as owner.' })
  create(@Body() dto: CreateCompanyDto, @CurrentUser() user: JwtUser) {
    return this.companiesService.create(dto, user.sub);
  }

  @Get('mine')
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Returns all companies the authenticated user is a member of.' })
  getMine(@CurrentUser() user: JwtUser) {
    return this.companiesService.findMine(user.sub);
  }

  @Get(':handle')
  @Public()
  @ApiOkResponse({ description: 'Returns a company by its handle.' })
  getByHandle(@Param('handle') handle: string) {
    return this.companiesService.findByHandle(handle);
  }

  @Patch(':handle')
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Updates company profile. Requires owner role.' })
  update(
    @Param('handle') handle: string,
    @Body() dto: UpdateCompanyDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.companiesService.update(handle, dto, user);
  }

  @Get(':handle/blogs')
  @Public()
  @ApiOkResponse({ type: BlogEntity, isArray: true, description: 'Returns published blogs for a company, newest first.' })
  getBlogs(@Param('handle') handle: string): Promise<BlogEntity[]> {
    return this.companiesService.findPublishedBlogs(handle);
  }

  // ── Members ───────────────────────────────────────────────────────────────────

  @Get(':handle/members')
  @Public()
  @ApiOkResponse({ description: 'Returns all members of a company.' })
  getMembers(@Param('handle') handle: string) {
    return this.companiesService.getMembers(handle);
  }

  @Delete(':handle/members/:userId')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOkResponse({ description: 'Removes a member from the company. Requires owner role.' })
  removeMember(
    @Param('handle') handle: string,
    @Param('userId') userId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.companiesService.removeMember(handle, userId, user);
  }

  // ── Invites ───────────────────────────────────────────────────────────────────

  @Post(':handle/invites')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOkResponse({ description: 'Sends an invite email to a prospective author. Requires owner role.' })
  inviteAuthor(
    @Param('handle') handle: string,
    @Body() dto: InviteAuthorDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.companiesService.inviteAuthor(handle, dto, user);
  }

  @Post('invites/:token/accept')
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Accepts a company invite and joins as author.' })
  acceptInvite(@Param('token') token: string, @CurrentUser() user: JwtUser) {
    return this.companiesService.acceptInvite(token, user);
  }

  @Post('invites/:token/decline')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOkResponse({ description: 'Declines a company invite.' })
  declineInvite(@Param('token') token: string, @CurrentUser() user: JwtUser) {
    return this.companiesService.declineInvite(token, user);
  }

  // ── Milestones ────────────────────────────────────────────────────────────────

  @Post(':handle/milestones')
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Adds a milestone to the company timeline. Requires owner role.' })
  addMilestone(
    @Param('handle') handle: string,
    @Body() dto: CreateMilestoneDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.companiesService.addMilestone(handle, dto, user);
  }

  @Get(':handle/milestones')
  @Public()
  @ApiOkResponse({ description: 'Returns all milestones for a company, newest first.' })
  getMilestones(@Param('handle') handle: string) {
    return this.companiesService.getMilestones(handle);
  }
}
