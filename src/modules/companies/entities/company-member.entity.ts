import { ApiProperty } from '@nestjs/swagger';
import { CompanyRole } from '@prisma/client';

export class CompanyMemberEntity {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  companyId: string;

  @ApiProperty({ format: 'uuid' })
  userId: string;

  @ApiProperty({ enum: CompanyRole })
  role: CompanyRole;

  @ApiProperty()
  joinedAt: Date;

  @ApiProperty({ required: false })
  displayName?: string;

  @ApiProperty({ required: false })
  username?: string;

  @ApiProperty({ required: false, nullable: true })
  avatarUrl?: string | null;

  constructor(partial: Partial<CompanyMemberEntity>) {
    Object.assign(this, partial);
  }
}
