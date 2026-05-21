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

import { CreateCompanyDto } from '../dto/create-company.dto';
import { CreateMilestoneDto } from '../dto/create-milestone.dto';
import { InviteAuthorDto } from '../dto/invite-author.dto';
import { UpdateCompanyDto } from '../dto/update-company.dto';
import { CompanyEntity } from '../entities/company.entity';
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

  // Static routes before /:handle to avoid shadowing
  @Get('featured')
  @Public()
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOkResponse({ type: CompanyEntity, isArray: true, description: 'Returns featured companies.' })
  getFeatured(@Query('limit') limit = 6) {
    return this.companiesService.findFeatured(+limit);
  }

  @Get('by-id/:id')
  @Public()
  @ApiOkResponse({ type: CompanyEntity, description: 'Returns a company by its UUID.' })
  getById(@Param('id') id: string) {
    return this.companiesService.findById(id);
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
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'sort', required: false, enum: ['newest', 'oldest'] })
  @ApiOkResponse({ description: 'Returns paginated published blogs for a company.' })
  getBlogs(
    @Param('handle') handle: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('sort') sort: 'newest' | 'oldest' = 'newest',
  ) {
    return this.companiesService.findPublishedBlogs(handle, +page, +limit, sort);
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

  @Get(':handle/invites')
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Returns all pending invites for the company. Requires owner role.' })
  listInvites(@Param('handle') handle: string, @CurrentUser() user: JwtUser) {
    return this.companiesService.listInvites(handle, user);
  }

  @Delete(':handle/invites/:inviteId')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOkResponse({ description: 'Revokes a pending invite. Requires owner role.' })
  revokeInvite(
    @Param('handle') handle: string,
    @Param('inviteId') inviteId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.companiesService.revokeInvite(handle, inviteId, user);
  }

  @Post(':handle/invites/:inviteId/resend')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOkResponse({ description: 'Resends a pending invite email. Requires owner role.' })
  resendInvite(
    @Param('handle') handle: string,
    @Param('inviteId') inviteId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.companiesService.resendInvite(handle, inviteId, user);
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
