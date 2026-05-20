import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '@database/prisma/prisma.service';

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.UserCreateInput) {
    return this.prisma.user.create({ data });
  }

  findMany(skip = 0, take = 20) {
    return this.prisma.user.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
  }

  findById(id: string) {
    return this.prisma.user.findFirst({ where: { id, deletedAt: null } });
  }

  findByEmail(email: string) {
    return this.prisma.user.findFirst({ where: { email, deletedAt: null } });
  }

  update(id: string, data: Prisma.UserUpdateInput) {
    return this.prisma.user.update({ where: { id }, data });
  }

  delete(id: string) {
    return this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  markEmailVerified(id: string) {
    return this.prisma.user.update({
      where: { id },
      data: { isEmailVerified: true },
    });
  }

  createAuditLog(event: string, userId: string) {
    return this.prisma.authAuditLog.create({ data: { event, userId } });
  }
}
