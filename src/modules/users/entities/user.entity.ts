import { ApiProperty } from '@nestjs/swagger';
import { AuthProvider, PlatformRole } from '@prisma/client';
import { Exclude } from 'class-transformer';

export class UserEntity {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'email' })
  email: string;

  @ApiProperty({ enum: AuthProvider })
  provider: AuthProvider;

  @ApiProperty()
  isEmailVerified: boolean;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty({ enum: PlatformRole })
  platformRole: PlatformRole;

  @ApiProperty()
  createdAt: Date;

  @Exclude()
  password?: string | null;

  @Exclude()
  providerId?: string | null;

  @Exclude()
  passwordChangedAt?: Date | null;

  @Exclude()
  deletedAt?: Date | null;

  constructor(partial: Partial<UserEntity>) {
    Object.assign(this, partial);
  }
}
