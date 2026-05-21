import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '@database/prisma/prisma.service';

@Injectable()
export class FollowsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Author follows ────────────────────────────────────────────────────────────

  async followAuthor(followerId: string, authorProfileId: string) {
    const profile = await this.prisma.authorProfile.findUnique({ where: { id: authorProfileId } });
    if (!profile) throw new NotFoundException('Author profile not found.');

    if (profile.userId === followerId) {
      throw new ConflictException('You cannot follow yourself.');
    }

    const existing = await this.prisma.follow.findUnique({
      where: { uq_follows_follower_author: { followerId, authorProfileId } },
    });
    if (existing) throw new ConflictException('Already following this author.');

    await this.prisma.follow.create({ data: { followerId, authorProfileId } });
    const count = await this.prisma.follow.count({ where: { authorProfileId } });
    return { followersCount: count };
  }

  async unfollowAuthor(followerId: string, authorProfileId: string) {
    const existing = await this.prisma.follow.findUnique({
      where: { uq_follows_follower_author: { followerId, authorProfileId } },
    });
    if (!existing) throw new NotFoundException('You are not following this author.');

    await this.prisma.follow.delete({
      where: { uq_follows_follower_author: { followerId, authorProfileId } },
    });
    const count = await this.prisma.follow.count({ where: { authorProfileId } });
    return { followersCount: count };
  }

  async getAuthorFollowersCount(authorProfileId: string): Promise<number> {
    return this.prisma.follow.count({ where: { authorProfileId } });
  }

  async isFollowingAuthor(followerId: string, authorProfileId: string): Promise<boolean> {
    const record = await this.prisma.follow.findUnique({
      where: { uq_follows_follower_author: { followerId, authorProfileId } },
    });
    return record !== null;
  }

  // ── Company follows ───────────────────────────────────────────────────────────

  async followCompany(followerId: string, companyId: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Company not found.');

    const existing = await this.prisma.companyFollow.findUnique({
      where: { uq_company_follows_follower_company: { followerId, companyId } },
    });
    if (existing) throw new ConflictException('Already following this company.');

    await this.prisma.companyFollow.create({ data: { followerId, companyId } });
    const count = await this.prisma.companyFollow.count({ where: { companyId } });
    return { followersCount: count };
  }

  async unfollowCompany(followerId: string, companyId: string) {
    const existing = await this.prisma.companyFollow.findUnique({
      where: { uq_company_follows_follower_company: { followerId, companyId } },
    });
    if (!existing) throw new NotFoundException('You are not following this company.');

    await this.prisma.companyFollow.delete({
      where: { uq_company_follows_follower_company: { followerId, companyId } },
    });
    const count = await this.prisma.companyFollow.count({ where: { companyId } });
    return { followersCount: count };
  }

  async getCompanyFollowersCount(companyId: string): Promise<number> {
    return this.prisma.companyFollow.count({ where: { companyId } });
  }

  async isFollowingCompany(followerId: string, companyId: string): Promise<boolean> {
    const record = await this.prisma.companyFollow.findUnique({
      where: { uq_company_follows_follower_company: { followerId, companyId } },
    });
    return record !== null;
  }
}
