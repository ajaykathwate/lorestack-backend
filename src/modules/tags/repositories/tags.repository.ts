import { Injectable } from '@nestjs/common';

import { PrismaService } from '@database/prisma/prisma.service';

@Injectable()
export class TagsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll(approvedOnly = true) {
    return this.prisma.tag.findMany({
      where: approvedOnly ? { isApproved: true } : undefined,
      orderBy: { blogCount: 'desc' },
    });
  }

  findBySlug(slug: string) {
    return this.prisma.tag.findUnique({ where: { slug } });
  }

  findById(id: string) {
    return this.prisma.tag.findUnique({ where: { id } });
  }

  findByName(name: string) {
    return this.prisma.tag.findUnique({ where: { name } });
  }

  findManyByIds(ids: string[]) {
    return this.prisma.tag.findMany({ where: { id: { in: ids } } });
  }

  create(name: string, slug: string, description?: string) {
    return this.prisma.tag.create({
      data: { name, slug, description, isApproved: false },
    });
  }

  incrementBlogCount(tagId: string) {
    return this.prisma.tag.update({
      where: { id: tagId },
      data: { blogCount: { increment: 1 } },
    });
  }

  decrementBlogCount(tagId: string) {
    return this.prisma.tag.update({
      where: { id: tagId },
      data: { blogCount: { decrement: 1 } },
    });
  }

  incrementBlogCountForMany(tagIds: string[]) {
    if (!tagIds.length) return Promise.resolve({ count: 0 });
    return this.prisma.tag.updateMany({
      where: { id: { in: tagIds } },
      data: { blogCount: { increment: 1 } },
    });
  }

  decrementBlogCountForMany(tagIds: string[]) {
    if (!tagIds.length) return Promise.resolve({ count: 0 });
    return this.prisma.tag.updateMany({
      where: { id: { in: tagIds } },
      data: { blogCount: { decrement: 1 } },
    });
  }

  approve(id: string) {
    return this.prisma.tag.update({ where: { id }, data: { isApproved: true } });
  }
}
