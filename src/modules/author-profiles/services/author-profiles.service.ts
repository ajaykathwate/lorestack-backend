import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { mapPrismaError } from '@database/prisma/prisma.exceptions';

import { UpdateAuthorProfileDto } from '../dto/update-author-profile.dto';
import { AuthorProfileEntity } from '../entities/author-profile.entity';
import { AuthorProfilesRepository } from '../repositories/author-profiles.repository';

@Injectable()
export class AuthorProfilesService {
  constructor(private readonly repo: AuthorProfilesRepository) {}

  async findByUsername(username: string): Promise<AuthorProfileEntity> {
    const profile = await this.repo.findByUsername(username);
    if (!profile) {
      throw new NotFoundException('Author profile not found');
    }
    return new AuthorProfileEntity(profile);
  }

  async findMe(userId: string): Promise<AuthorProfileEntity> {
    const profile = await this.repo.findByUserId(userId);
    if (!profile) {
      throw new NotFoundException('Author profile not found. Please complete onboarding.');
    }
    return new AuthorProfileEntity(profile);
  }

  async updateMe(userId: string, dto: UpdateAuthorProfileDto): Promise<AuthorProfileEntity> {
    await this.findMe(userId);

    if (dto.username) {
      const existing = await this.repo.findByUsername(dto.username);
      if (existing && existing.userId !== userId) {
        throw new ConflictException('This username is already taken.');
      }
    }

    try {
      const profile = await this.repo.update(userId, dto);
      return new AuthorProfileEntity(profile);
    } catch (error) {
      mapPrismaError(error);
    }
  }
}
