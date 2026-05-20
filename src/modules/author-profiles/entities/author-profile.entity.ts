import { ApiProperty } from '@nestjs/swagger';

export class AuthorProfileEntity {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  userId: string;

  @ApiProperty()
  displayName: string;

  @ApiProperty()
  username: string;

  @ApiProperty({ required: false, nullable: true })
  bio?: string | null;

  @ApiProperty({ required: false, nullable: true })
  avatarUrl?: string | null;

  @ApiProperty({ type: [String] })
  expertiseTags: string[];

  @ApiProperty({ required: false, nullable: true })
  twitterHandle?: string | null;

  @ApiProperty({ required: false, nullable: true })
  linkedinUrl?: string | null;

  @ApiProperty({ required: false, nullable: true })
  githubHandle?: string | null;

  @ApiProperty({ required: false, nullable: true })
  websiteUrl?: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  constructor(partial: Partial<AuthorProfileEntity>) {
    Object.assign(this, partial);
  }
}
