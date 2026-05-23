import { Injectable } from '@nestjs/common';
import { CompanyRole, InviteStatus, Prisma } from '@prisma/client';

import { PrismaService } from '@database/prisma/prisma.service';

@Injectable()
export class CompaniesRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ── Company ───────────────────────────────────────────────────────────────────

  create(data: Prisma.CompanyCreateInput) {
    return this.prisma.company.create({ data });
  }

  findByHandle(handle: string) {
    return this.prisma.company.findUnique({ where: { handle } });
  }

  findById(id: string) {
    return this.prisma.company.findUnique({ where: { id } });
  }

  findManyByUserId(userId: string) {
    return this.prisma.company.findMany({
      where: { memberships: { some: { userId } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  update(id: string, data: Prisma.CompanyUpdateInput) {
    return this.prisma.company.update({ where: { id }, data });
  }

  // ── Members ───────────────────────────────────────────────────────────────────

  findMembership(companyId: string, userId: string) {
    return this.prisma.companyMembership.findUnique({
      where: { uq_company_memberships_company_user: { companyId, userId } },
    });
  }

  findMembershipByEmail(companyId: string, email: string) {
    return this.prisma.companyMembership.findFirst({
      where: { companyId, user: { email } },
    });
  }

  createMembership(companyId: string, userId: string, role: CompanyRole) {
    return this.prisma.companyMembership.create({ data: { companyId, userId, role } });
  }

  findMembers(companyId: string) {
    return this.prisma.companyMembership.findMany({
      where: { companyId },
      include: { user: { include: { authorProfile: true } } },
      orderBy: { joinedAt: 'asc' },
    });
  }

  deleteMembership(companyId: string, userId: string) {
    return this.prisma.companyMembership.delete({
      where: { uq_company_memberships_company_user: { companyId, userId } },
    });
  }

  // ── Invites ───────────────────────────────────────────────────────────────────

  findPendingInvite(companyId: string, email: string) {
    return this.prisma.companyInvite.findFirst({
      where: { companyId, invitedEmail: email, status: InviteStatus.pending },
    });
  }

  findPendingInvites(companyId: string) {
    return this.prisma.companyInvite.findMany({
      where: { companyId, status: InviteStatus.pending },
      orderBy: { expiresAt: 'asc' },
    });
  }

  findInviteById(id: string) {
    return this.prisma.companyInvite.findUnique({ where: { id } });
  }

  findInviteByToken(token: string) {
    return this.prisma.companyInvite.findUnique({
      where: { token },
      include: { company: true },
    });
  }

  createInvite(data: Prisma.CompanyInviteCreateInput) {
    return this.prisma.companyInvite.create({ data });
  }

  updateInviteStatus(id: string, status: InviteStatus, acceptedAt?: Date) {
    return this.prisma.companyInvite.update({
      where: { id },
      data: { status, ...(acceptedAt ? { acceptedAt } : {}) },
    });
  }

  deleteInvite(id: string) {
    return this.prisma.companyInvite.delete({ where: { id } });
  }

  findPublishedByCompanyIdPaginated(
    companyId: string,
    skip: number,
    take: number,
    sort: 'newest' | 'oldest' = 'newest',
  ) {
    return this.prisma.blog.findMany({
      where: { companyId, status: 'published' },
      orderBy: { publishedAt: sort === 'oldest' ? 'asc' : 'desc' },
      skip,
      take,
    });
  }

  findAllPublic(skip: number, take: number) {
    return this.prisma.company.findMany({
      where: { isPublic: true },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
  }

  countAllPublic() {
    return this.prisma.company.count({ where: { isPublic: true } });
  }

  countFeatured() {
    return this.prisma.company.count({ where: { featured: true, isPublic: true } });
  }

  findFeatured(limit: number) {
    return this.prisma.company.findMany({
      where: { featured: true, isPublic: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  // ── Milestones ────────────────────────────────────────────────────────────────

  createMilestone(data: Prisma.CompanyMilestoneCreateInput) {
    return this.prisma.companyMilestone.create({ data });
  }

  findMilestones(companyId: string) {
    return this.prisma.companyMilestone.findMany({
      where: { companyId },
      orderBy: { milestoneDate: 'desc' },
    });
  }
}
