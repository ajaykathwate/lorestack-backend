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

    const existing = await this.prisma.authorFollow.findUnique({
      where: { uq_author_follows_follower_author: { followerId, authorProfileId } },
    });
    if (existing) throw new ConflictException('Already following this author.');

    await this.prisma.authorFollow.create({ data: { followerId, authorProfileId } });
    const count = await this.prisma.authorFollow.count({ where: { authorProfileId } });
    return { followersCount: count };
  }

  async unfollowAuthor(followerId: string, authorProfileId: string) {
    const existing = await this.prisma.authorFollow.findUnique({
      where: { uq_author_follows_follower_author: { followerId, authorProfileId } },
    });
    if (!existing) throw new NotFoundException('You are not following this author.');

    await this.prisma.authorFollow.delete({
      where: { uq_author_follows_follower_author: { followerId, authorProfileId } },
    });
    const count = await this.prisma.authorFollow.count({ where: { authorProfileId } });
    return { followersCount: count };
  }

  async getAuthorFollowersCount(authorProfileId: string): Promise<number> {
    return this.prisma.authorFollow.count({ where: { authorProfileId } });
  }

  async isFollowingAuthor(followerId: string, authorProfileId: string): Promise<boolean> {
    const record = await this.prisma.authorFollow.findUnique({
      where: { uq_author_follows_follower_author: { followerId, authorProfileId } },
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

  // ── Tag follows ───────────────────────────────────────────────────────────────

  async followTag(followerId: string, tagId: string) {
    const tag = await this.prisma.tag.findUnique({ where: { id: tagId } });
    if (!tag) throw new NotFoundException('Tag not found.');

    const existing = await this.prisma.tagFollow.findUnique({
      where: { uq_tag_follows_follower_tag: { followerId, tagId } },
    });
    if (existing) throw new ConflictException('Already following this tag.');

    await this.prisma.tagFollow.create({ data: { followerId, tagId } });
    const count = await this.prisma.tagFollow.count({ where: { tagId } });
    return { followersCount: count };
  }

  async unfollowTag(followerId: string, tagId: string) {
    const existing = await this.prisma.tagFollow.findUnique({
      where: { uq_tag_follows_follower_tag: { followerId, tagId } },
    });
    if (!existing) throw new NotFoundException('You are not following this tag.');

    await this.prisma.tagFollow.delete({
      where: { uq_tag_follows_follower_tag: { followerId, tagId } },
    });
    const count = await this.prisma.tagFollow.count({ where: { tagId } });
    return { followersCount: count };
  }

  async getTagFollowersCount(tagId: string): Promise<number> {
    return this.prisma.tagFollow.count({ where: { tagId } });
  }

  // ── My followers ─────────────────────────────────────────────────────────────

  async getMyFollowers(userId: string) {
    const profile = await this.prisma.authorProfile.findUnique({ where: { userId } });
    if (!profile) return [];

    const rows = await this.prisma.authorFollow.findMany({
      where: { authorProfileId: profile.id },
      include: { follower: { include: { authorProfile: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((r) => r.follower.authorProfile).filter(Boolean);
  }

  // ── My following lists ────────────────────────────────────────────────────────

  async getFollowingAuthors(userId: string) {
    const rows = await this.prisma.authorFollow.findMany({
      where: { followerId: userId },
      include: { authorProfile: true },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => r.authorProfile);
  }

  async getFollowingCompanies(userId: string) {
    const rows = await this.prisma.companyFollow.findMany({
      where: { followerId: userId },
      include: { company: true },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => r.company);
  }

  async getFollowingTags(userId: string) {
    const rows = await this.prisma.tagFollow.findMany({
      where: { followerId: userId },
      include: { tag: true },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => r.tag);
  }
}
