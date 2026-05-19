import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import { PASSWORD_HASH_ROUNDS } from '@common/constants/app.constants';
import { PaginationQueryDto } from '@common/dto/pagination-query.dto';
import { PrismaService } from '@database/prisma/prisma.service';
import { mapPrismaError } from '@database/prisma/prisma.exceptions';

import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { UserEntity } from '../entities/user.entity';
import { UsersRepository } from '../repositories/users.repository';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly prisma: PrismaService,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<UserEntity> {
    const existingUser = await this.findExistingUser(createUserDto.email, createUserDto.username);

    if (existingUser) {
      throw new ConflictException('User with this email or username already exists');
    }

    const password = await bcrypt.hash(createUserDto.password, PASSWORD_HASH_ROUNDS);

    try {
      const user = await this.usersRepository.create({
        ...createUserDto,
        password,
      });

      await this.audit('user_created', user.id);
      return new UserEntity(user);
    } catch (error) {
      mapPrismaError(error);
    }
  }

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

  async findByEmail(email: string) {
    return this.usersRepository.findByEmail(email);
  }

  async findByUsername(username: string) {
    return this.usersRepository.findByUsername(username);
  }

  async updatePassword(id: string, password: string): Promise<UserEntity> {
    const hashedPassword = await bcrypt.hash(password, PASSWORD_HASH_ROUNDS);
    const user = await this.usersRepository.updatePassword(id, hashedPassword);
    return new UserEntity(user);
  }

  async markEmailVerified(id: string): Promise<UserEntity> {
    const user = await this.usersRepository.markEmailVerified(id);
    return new UserEntity(user);
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<UserEntity> {
    await this.findOne(id);

    const updateData = { ...updateUserDto };

    if (updateUserDto.password) {
      updateData.password = await bcrypt.hash(updateUserDto.password, PASSWORD_HASH_ROUNDS);
    }

    try {
      const user = await this.usersRepository.update(id, updateData);
      await this.audit('user_updated', id);
      return new UserEntity(user);
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async remove(id: string): Promise<UserEntity> {
    await this.findOne(id);

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
      await this.prisma.authAuditLog.create({ data: { event, userId } });
    } catch {
      this.logger.warn(`Failed to write audit log: ${event} for user ${userId}`);
    }
  }

  private async findExistingUser(email: string, username: string) {
    const [byEmail, byUsername] = await Promise.all([
      this.usersRepository.findByEmail(email),
      this.usersRepository.findByUsername(username),
    ]);

    return byEmail ?? byUsername;
  }
}
