import { ApiProperty } from '@nestjs/swagger';
import { Exclude } from 'class-transformer';

export class UserEntity {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  username: string;

  @ApiProperty({ format: 'email' })
  email: string;

  @Exclude()
  password: string;

  @ApiProperty({ required: false, nullable: true })
  emailVerifiedAt?: Date | null;

  @ApiProperty({ required: false, nullable: true })
  passwordChangedAt?: Date | null;

  @Exclude()
  deletedAt?: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  constructor(partial: Partial<UserEntity>) {
    Object.assign(this, partial);
  }
}
