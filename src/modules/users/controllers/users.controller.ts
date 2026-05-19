import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { CurrentUser } from '@common/decorators/current-user.decorator';
import { Public } from '@common/decorators/public.decorator';
import { PaginationQueryDto } from '@common/dto/pagination-query.dto';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { JwtUser } from '@modules/auth/types/jwt-user.type';

import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { UserEntity } from '../entities/user.entity';
import { UsersService } from '../services/users.service';

@ApiTags('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Public()
  @ApiCreatedResponse({ type: UserEntity })
  create(@Body() createUserDto: CreateUserDto): Promise<UserEntity> {
    return this.usersService.create(createUserDto);
  }

  @Get()
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
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<UserEntity> {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOkResponse({ type: UserEntity })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<UserEntity> {
    return this.usersService.remove(id);
  }
}
