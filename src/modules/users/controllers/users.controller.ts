import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { PlatformRole } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';

import { CurrentUser } from '@common/decorators/current-user.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { PaginationQueryDto } from '@common/dto/pagination-query.dto';
import { RolesGuard } from '@common/guards/roles.guard';
import { JwtUser } from '@modules/auth/types/jwt-user.type';

import { UpdateUserDto } from '../dto/update-user.dto';
import { UserEntity } from '../entities/user.entity';
import { UsersService } from '../services/users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles(PlatformRole.platform_admin)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOkResponse({ type: UserEntity, isArray: true })
  findAll(@Query() paginationQuery: PaginationQueryDto): Promise<UserEntity[]> {
    return this.usersService.findAll(paginationQuery);
  }

  @Get('me')
  @ApiOkResponse({ type: UserEntity })
  me(@CurrentUser() user: JwtUser): Promise<UserEntity> {
    return this.usersService.findOne(user.sub);
  }

  @Get(':id')
  @ApiOkResponse({ type: UserEntity })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<UserEntity> {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOkResponse({ type: UserEntity })
  update(
    @CurrentUser() currentUser: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<UserEntity> {
    return this.usersService.update(id, updateUserDto, currentUser.sub, currentUser.platformRole);
  }

  @Delete(':id')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOkResponse({ type: UserEntity })
  remove(
    @CurrentUser() currentUser: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<UserEntity> {
    return this.usersService.remove(id, currentUser.sub, currentUser.platformRole);
  }
}
