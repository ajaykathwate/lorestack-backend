import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PlatformRole } from '@prisma/client';

import { PaginationQueryDto } from '@common/dto/pagination-query.dto';
import { permissionChecker } from '@common/permissions/permission-checker';
import { mapPrismaError } from '@database/prisma/prisma.exceptions';

import { UpdateUserDto } from '../dto/update-user.dto';
import { UserEntity } from '../entities/user.entity';
import { UsersRepository } from '../repositories/users.repository';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly usersRepository: UsersRepository) {}

  async findAll(pagination: PaginationQueryDto): Promise<UserEntity[]> {
    const skip = ((pagination.page ?? 1) - 1) * (pagination.limit ?? 20);
    const users = await this.usersRepository.findMany(skip, pagination.limit ?? 20);
    return users.map((user) => new UserEntity(user));
  }

  async findOne(id: string): Promise<UserEntity> {
    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return new UserEntity(user);
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
    requesterId: string,
    requesterRole: PlatformRole,
  ): Promise<UserEntity> {
    await this.findOne(id);

    const isSelf = requesterId === id;
    if (!isSelf && !permissionChecker.canManageUsers(requesterRole)) {
      throw new ForbiddenException('You can only update your own account.');
    }

    try {
      const user = await this.usersRepository.update(id, updateUserDto);
      await this.audit('user_updated', id);
      return new UserEntity(user);
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async remove(id: string, requesterId: string, requesterRole: PlatformRole): Promise<UserEntity> {
    await this.findOne(id);

    const isSelf = requesterId === id;
    if (!isSelf && !permissionChecker.canManageUsers(requesterRole)) {
      throw new ForbiddenException('You can only delete your own account.');
    }

    try {
      const user = await this.usersRepository.delete(id);
      await this.audit('user_deleted', id);
      return new UserEntity(user);
    } catch (error) {
      mapPrismaError(error);
    }
  }

  private async audit(event: string, userId: string) {
    try {
      await this.usersRepository.createAuditLog(event, userId);
    } catch {
      this.logger.warn(`Failed to write audit log: ${event} for user ${userId}`);
    }
  }
}
