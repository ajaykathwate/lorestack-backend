import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CompanyRole, InviteStatus } from '@prisma/client';
import { randomBytes } from 'crypto';

import { permissionChecker } from '@common/permissions/permission-checker';
import { mapPrismaError } from '@database/prisma/prisma.exceptions';
import { PaginatedResponse } from '@common/dto/paginated-response.dto';
import { JwtUser } from '@modules/auth/types/jwt-user.type';
import { BlogSummaryEntity } from '@modules/blogs/entities/blog-summary.entity';
import { BlogsRepository, SortOrder } from '@modules/blogs/repositories/blogs.repository';
import { toBlogSummaryEntity } from '@modules/blogs/mappers/blog.mappers';
import { MailService } from '@modules/mail/mail.service';
import { NOTIFICATION_EVENTS } from '@modules/notifications/events/notification-event-names';
import {
  CompanyInviteReceivedEvent,
  CompanyInviteRespondedEvent,
  CompanyMilestoneEvent,
} from '@modules/notifications/events/notification.events';
import { PrismaService } from '@database/prisma/prisma.service';

import { CreateCompanyDto } from '../dto/create-company.dto';
import { CreateMilestoneDto } from '../dto/create-milestone.dto';
import { InviteAuthorDto } from '../dto/invite-author.dto';
import { UpdateCompanyDto } from '../dto/update-company.dto';
import { CompanyMemberEntity } from '../entities/company-member.entity';
import { CompanyMilestoneEntity } from '../entities/company-milestone.entity';
import { CompanyEntity } from '../entities/company.entity';
import { CompaniesRepository } from '../repositories/companies.repository';

@Injectable()
export class CompaniesService {
  private readonly logger = new Logger(CompaniesService.name);

  constructor(
    private readonly repo: CompaniesRepository,
    @Inject(forwardRef(() => BlogsRepository))
    private readonly blogsRepo: BlogsRepository,
    private readonly mailService: MailService,
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ── Company CRUD ──────────────────────────────────────────────────────────────

  async create(dto: CreateCompanyDto, userId: string): Promise<CompanyEntity> {
    const existing = await this.repo.findByHandle(dto.handle);
    if (existing) {
      throw new ConflictException('A company with this handle already exists.');
    }

    try {
      const company = await this.repo.create({
        name: dto.name,
        handle: dto.handle,
        tagline: dto.tagline,
        websiteUrl: dto.websiteUrl,
        logoUrl: dto.logoUrl,
        coverImageUrl: dto.coverImageUrl,
        industry: dto.industry,
        stage: dto.stage,
        techStack: dto.techStack ?? [],
        galleryImages: dto.galleryImages ?? [],
        founderSocialLink: dto.founderSocialLink,
        isPublic: dto.isPublic ?? true,
        creator: { connect: { id: userId } },
        memberships: {
          create: { userId, role: CompanyRole.owner },
        },
      });
      return new CompanyEntity(company);
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async findMine(userId: string): Promise<CompanyEntity[]> {
    const companies = await this.repo.findManyByUserId(userId);
    return companies.map((c) => new CompanyEntity(c));
  }

  async findByHandle(handle: string): Promise<CompanyEntity> {
    const company = await this.repo.findByHandle(handle);
    if (!company) throw new NotFoundException('Company not found.');
    return new CompanyEntity(company);
  }

  async findById(id: string): Promise<CompanyEntity> {
    const company = await this.repo.findById(id);
    if (!company) throw new NotFoundException('Company not found.');
    return new CompanyEntity(company);
  }

  async findAllPublic(page: number, limit: number): Promise<PaginatedResponse<CompanyEntity>> {
    const skip = (page - 1) * limit;
    const [companies, total] = await Promise.all([
      this.repo.findAllPublic(skip, limit),
      this.repo.countAllPublic(),
    ]);
    return new PaginatedResponse(companies.map((c) => new CompanyEntity(c)), total, page, limit);
  }

  async findFeatured(limit: number): Promise<CompanyEntity[]> {
    const companies = await this.repo.findFeatured(limit);
    return companies.map((c) => new CompanyEntity(c));
  }

  async update(handle: string, dto: UpdateCompanyDto, requester: JwtUser): Promise<CompanyEntity> {
    const company = await this.repo.findByHandle(handle);
    if (!company) throw new NotFoundException('Company not found.');

    const membership = await this.repo.findMembership(company.id, requester.sub);
    const companyRole = membership?.role ?? null;

    if (!permissionChecker.canEditCompanyProfile(requester.platformRole, companyRole)) {
      throw new ForbiddenException('Only company owners can update the company profile.');
    }

    try {
      const updated = await this.repo.update(company.id, dto);
      return new CompanyEntity(updated);
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async findPublishedBlogs(
    handle: string,
    page = 1,
    limit = 20,
    sort: SortOrder = 'newest',
  ): Promise<PaginatedResponse<BlogSummaryEntity>> {
    const company = await this.repo.findByHandle(handle);
    if (!company) throw new NotFoundException('Company not found.');

    const skip = (page - 1) * limit;
    const [blogs, total] = await Promise.all([
      this.blogsRepo.findPublishedByCompanyId(company.id, { skip, take: limit, sort }),
      this.blogsRepo.countPublishedByCompanyId(company.id),
    ]);
    return new PaginatedResponse(blogs.map(toBlogSummaryEntity), total, page, limit);
  }

  // ── Members ───────────────────────────────────────────────────────────────────

  async getMembers(handle: string): Promise<CompanyMemberEntity[]> {
    const company = await this.repo.findByHandle(handle);
    if (!company) throw new NotFoundException('Company not found.');

    const memberships = await this.repo.findMembers(company.id);
    return memberships.map(
      (m) =>
        new CompanyMemberEntity({
          id: m.id,
          companyId: m.companyId,
          userId: m.userId,
          role: m.role,
          joinedAt: m.joinedAt,
          displayName: m.user.authorProfile?.displayName,
          username: m.user.authorProfile?.username,
          avatarUrl: m.user.authorProfile?.avatarUrl,
        }),
    );
  }

  async removeMember(handle: string, targetUserId: string, requester: JwtUser): Promise<void> {
    const company = await this.repo.findByHandle(handle);
    if (!company) throw new NotFoundException('Company not found.');

    const membership = await this.repo.findMembership(company.id, requester.sub);
    const companyRole = membership?.role ?? null;

    if (!permissionChecker.canRemoveAuthors(requester.platformRole, companyRole)) {
      throw new ForbiddenException('Only company owners can remove members.');
    }

    const targetMembership = await this.repo.findMembership(company.id, targetUserId);
    if (!targetMembership) throw new NotFoundException('Member not found in this company.');

    if (targetMembership.role === CompanyRole.owner && targetUserId === company.createdByUserId) {
      throw new BadRequestException('Cannot remove the original company creator.');
    }

    await this.repo.deleteMembership(company.id, targetUserId);
  }

  // ── Invites ───────────────────────────────────────────────────────────────────

  async inviteAuthor(handle: string, dto: InviteAuthorDto, requester: JwtUser): Promise<void> {
    const company = await this.repo.findByHandle(handle);
    if (!company) throw new NotFoundException('Company not found.');

    const membership = await this.repo.findMembership(company.id, requester.sub);
    const companyRole = membership?.role ?? null;

    if (!permissionChecker.canInviteAuthors(requester.platformRole, companyRole)) {
      throw new ForbiddenException('Only company owners can invite authors.');
    }

    if (dto.email === requester.email) {
      throw new ConflictException('You cannot invite yourself.');
    }

    const alreadyMember = await this.repo.findMembershipByEmail(company.id, dto.email);
    if (alreadyMember) {
      throw new ConflictException('This person is already on your team.');
    }

    const existing = await this.repo.findPendingInvite(company.id, dto.email);
    if (existing) {
      throw new ConflictException('A pending invite already exists for this email.');
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await this.repo.createInvite({
      company: { connect: { id: company.id } },
      invitedBy: { connect: { id: requester.sub } },
      invitedEmail: dto.email,
      token,
      expiresAt,
    });

    this.mailService.sendCompanyInviteEmail(dto.email, company.name, token).catch((err) =>
      this.logger.warn(`Invite email failed: ${err instanceof Error ? err.message : String(err)}`),
    );

    setImmediate(async () => {
      const inviterProfile = await this.prisma.authorProfile.findUnique({
        where: { userId: requester.sub },
        select: { displayName: true, username: true, avatarUrl: true },
      });
      if (!inviterProfile) return;
      const event = Object.assign(new CompanyInviteReceivedEvent(), {
        inviteToken: token,
        inviteExpiresAt: expiresAt,
        companyId: company.id,
        companyName: company.name,
        companyHandle: company.handle,
        companyLogoUrl: company.logoUrl ?? null,
        invitedByUserId: requester.sub,
        invitedByDisplayName: inviterProfile.displayName,
        invitedByUsername: inviterProfile.username,
        invitedByAvatarUrl: inviterProfile.avatarUrl ?? null,
        invitedEmail: dto.email,
      });
      this.eventEmitter.emit(NOTIFICATION_EVENTS.COMPANY_INVITE_RECEIVED, event);
    });
  }

  async listInvites(handle: string, requester: JwtUser) {
    const company = await this.repo.findByHandle(handle);
    if (!company) throw new NotFoundException('Company not found.');

    const membership = await this.repo.findMembership(company.id, requester.sub);
    if (!permissionChecker.canInviteAuthors(requester.platformRole, membership?.role ?? null)) {
      throw new ForbiddenException('Only company owners can view invites.');
    }

    return this.repo.findPendingInvites(company.id);
  }

  async revokeInvite(handle: string, inviteId: string, requester: JwtUser): Promise<void> {
    const company = await this.repo.findByHandle(handle);
    if (!company) throw new NotFoundException('Company not found.');

    const membership = await this.repo.findMembership(company.id, requester.sub);
    if (!permissionChecker.canInviteAuthors(requester.platformRole, membership?.role ?? null)) {
      throw new ForbiddenException('Only company owners can revoke invites.');
    }

    const invite = await this.repo.findInviteById(inviteId);
    if (!invite || invite.companyId !== company.id) throw new NotFoundException('Invite not found.');

    await this.repo.deleteInvite(inviteId);
  }

  async resendInvite(handle: string, inviteId: string, requester: JwtUser): Promise<void> {
    const company = await this.repo.findByHandle(handle);
    if (!company) throw new NotFoundException('Company not found.');

    const membership = await this.repo.findMembership(company.id, requester.sub);
    if (!permissionChecker.canInviteAuthors(requester.platformRole, membership?.role ?? null)) {
      throw new ForbiddenException('Only company owners can resend invites.');
    }

    const invite = await this.repo.findInviteById(inviteId);
    if (!invite || invite.companyId !== company.id) throw new NotFoundException('Invite not found.');

    if (invite.status !== InviteStatus.pending) {
      throw new BadRequestException('Only pending invites can be resent.');
    }

    const newToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.repo.deleteInvite(inviteId);
    await this.repo.createInvite({
      company: { connect: { id: company.id } },
      invitedBy: { connect: { id: requester.sub } },
      invitedEmail: invite.invitedEmail,
      token: newToken,
      expiresAt,
    });

    this.mailService.sendCompanyInviteEmail(invite.invitedEmail, company.name, newToken).catch((err) =>
      this.logger.warn(`Resend invite email failed: ${err instanceof Error ? err.message : String(err)}`),
    );
  }

  async acceptInvite(token: string, requester: JwtUser): Promise<CompanyEntity> {
    const invite = await this.repo.findInviteByToken(token);

    this.assertInviteUsable(invite, requester.email);
    // assertInviteUsable throws if invite is null — safe to assert here
    const safeInvite = invite!;

    const alreadyMember = await this.repo.findMembership(safeInvite.companyId, requester.sub);
    if (alreadyMember) {
      throw new ConflictException('You are already a member of this company.');
    }

    await this.repo.updateInviteStatus(safeInvite.id, InviteStatus.accepted, new Date());
    await this.repo.createMembership(safeInvite.companyId, requester.sub, CompanyRole.author);

    setImmediate(async () => {
      const [actorProfile, ownerRows] = await Promise.all([
        this.prisma.authorProfile.findUnique({
          where: { userId: requester.sub },
          select: { displayName: true, username: true, avatarUrl: true },
        }),
        this.prisma.companyMembership.findMany({
          where: { companyId: safeInvite.companyId, role: 'owner' },
          select: { userId: true },
        }),
      ]);
      if (!actorProfile) return;
      const ownerUserIds = ownerRows.map((r) => r.userId).filter((id) => id !== requester.sub);
      if (ownerUserIds.length === 0) return;
      const event = Object.assign(new CompanyInviteRespondedEvent(), {
        accepted: true,
        actorUserId: requester.sub,
        actorDisplayName: actorProfile.displayName,
        actorUsername: actorProfile.username,
        actorAvatarUrl: actorProfile.avatarUrl ?? null,
        companyId: safeInvite.companyId,
        companyName: safeInvite.company.name,
        companyHandle: safeInvite.company.handle,
        ownerUserIds,
      });
      this.eventEmitter.emit(NOTIFICATION_EVENTS.COMPANY_INVITE_RESPONDED, event);
    });

    return new CompanyEntity(safeInvite.company);
  }

  async declineInvite(token: string, requester: JwtUser): Promise<void> {
    const invite = await this.repo.findInviteByToken(token);

    this.assertInviteUsable(invite, requester.email);
    const safeInvite = invite!;

    await this.repo.updateInviteStatus(safeInvite.id, InviteStatus.declined);

    setImmediate(async () => {
      const [actorProfile, ownerRows] = await Promise.all([
        this.prisma.authorProfile.findUnique({
          where: { userId: requester.sub },
          select: { displayName: true, username: true, avatarUrl: true },
        }),
        this.prisma.companyMembership.findMany({
          where: { companyId: safeInvite.companyId, role: 'owner' },
          select: { userId: true },
        }),
      ]);
      if (!actorProfile) return;
      const ownerUserIds = ownerRows.map((r) => r.userId).filter((id) => id !== requester.sub);
      if (ownerUserIds.length === 0) return;
      const event = Object.assign(new CompanyInviteRespondedEvent(), {
        accepted: false,
        actorUserId: requester.sub,
        actorDisplayName: actorProfile.displayName,
        actorUsername: actorProfile.username,
        actorAvatarUrl: actorProfile.avatarUrl ?? null,
        companyId: safeInvite.companyId,
        companyName: safeInvite.company.name,
        companyHandle: safeInvite.company.handle,
        ownerUserIds,
      });
      this.eventEmitter.emit(NOTIFICATION_EVENTS.COMPANY_INVITE_RESPONDED, event);
    });
  }

  // ── Milestones ────────────────────────────────────────────────────────────────

  async addMilestone(
    handle: string,
    dto: CreateMilestoneDto,
    requester: JwtUser,
  ): Promise<CompanyMilestoneEntity> {
    const company = await this.repo.findByHandle(handle);
    if (!company) throw new NotFoundException('Company not found.');

    const membership = await this.repo.findMembership(company.id, requester.sub);
    const companyRole = membership?.role ?? null;

    if (!permissionChecker.canAddMilestone(requester.platformRole, companyRole)) {
      throw new ForbiddenException('Only company owners can add milestones.');
    }

    const milestone = await this.repo.createMilestone({
      company: { connect: { id: company.id } },
      createdByUser: { connect: { id: requester.sub } },
      type: dto.type,
      headline: dto.headline,
      description: dto.description,
      impactMetric: dto.impactMetric,
      milestoneDate: dto.milestoneDate,
    });

    setImmediate(() => {
      const event = Object.assign(new CompanyMilestoneEvent(), {
        milestoneId: milestone.id,
        milestoneType: milestone.type,
        milestoneHeadline: milestone.headline,
        milestoneImpactMetric: milestone.impactMetric ?? null,
        milestoneDateStr: milestone.milestoneDate.toISOString(),
        companyId: company.id,
        companyName: company.name,
        companyHandle: company.handle,
        companyLogoUrl: company.logoUrl ?? null,
      });
      this.eventEmitter.emit(NOTIFICATION_EVENTS.COMPANY_MILESTONE, event);
    });

    return new CompanyMilestoneEntity(milestone);
  }

  async getMilestones(handle: string): Promise<CompanyMilestoneEntity[]> {
    const company = await this.repo.findByHandle(handle);
    if (!company) throw new NotFoundException('Company not found.');

    const milestones = await this.repo.findMilestones(company.id);
    return milestones.map((m) => new CompanyMilestoneEntity(m));
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  private assertInviteUsable(
    invite: Awaited<ReturnType<CompaniesRepository['findInviteByToken']>>,
    requesterEmail: string,
  ) {
    if (!invite) throw new NotFoundException('Invite not found or already used.');

    if (invite.status !== InviteStatus.pending) {
      throw new BadRequestException('This invite has already been used or declined.');
    }

    if (invite.expiresAt < new Date()) {
      throw new BadRequestException('This invite has expired.');
    }

    if (invite.invitedEmail !== requesterEmail) {
      throw new ForbiddenException('This invite was sent to a different email address.');
    }
  }
}
