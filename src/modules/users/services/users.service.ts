import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import { PASSWORD_HASH_ROUNDS } from '@common/constants/app.constants';
import { mapPrismaError } from '@database/prisma/prisma.exceptions';

import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { UserEntity } from '../entities/user.entity';
import { UsersRepository } from '../repositories/users.repository';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

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

      return new UserEntity(user);
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async findAll(): Promise<UserEntity[]> {
    const users = await this.usersRepository.findMany();
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
      return new UserEntity(user);
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async remove(id: string): Promise<UserEntity> {
    await this.findOne(id);

    try {
      const user = await this.usersRepository.delete(id);
      return new UserEntity(user);
    } catch (error) {
      mapPrismaError(error);
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
