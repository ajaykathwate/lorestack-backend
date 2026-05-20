import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TagEntity {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  slug: string;

  @ApiPropertyOptional({ nullable: true })
  description?: string | null;

  @ApiProperty()
  blogCount: number;

  @ApiProperty()
  isApproved: boolean;

  @ApiProperty()
  createdAt: Date;

  constructor(partial: Partial<TagEntity>) {
    Object.assign(this, partial);
  }
}
