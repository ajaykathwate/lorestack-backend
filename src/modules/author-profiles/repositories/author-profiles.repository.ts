import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '@database/prisma/prisma.service';

@Injectable()
export class AuthorProfilesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByUserId(userId: string) {
    return this.prisma.authorProfile.findUnique({ where: { userId } });
  }

  findByUsername(username: string) {
    return this.prisma.authorProfile.findUnique({ where: { username } });
  }

  update(userId: string, data: Prisma.AuthorProfileUpdateInput) {
    return this.prisma.authorProfile.update({ where: { userId }, data });
  }
}
