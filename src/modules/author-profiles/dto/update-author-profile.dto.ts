import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateAuthorProfileDto {
  @ApiProperty({ required: false, example: 'Ajay Kathwate' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  displayName?: string;

  @ApiProperty({ required: false, example: 'ajay-kathwate' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  @Matches(/^[a-z0-9_-]+$/, {
    message: 'username may only contain lowercase letters, numbers, hyphens, and underscores',
  })
  username?: string;

  @ApiProperty({ required: false, example: 'I write about distributed systems.' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  bio?: string;

  @ApiProperty({ required: false, example: 'https://example.com/avatar.png' })
  @IsOptional()
  @IsUrl()
  avatarUrl?: string;

  @ApiProperty({ required: false, type: [String], example: ['TypeScript', 'NestJS'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  expertiseTags?: string[];

  @ApiProperty({ required: false, example: 'ajaykathwate' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  twitterHandle?: string;

  @ApiProperty({ required: false, example: 'https://linkedin.com/in/ajay' })
  @IsOptional()
  @IsUrl()
  linkedinUrl?: string;

  @ApiProperty({ required: false, example: 'ajaykathwate' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  githubHandle?: string;

  @ApiProperty({ required: false, example: 'https://ajay.dev' })
  @IsOptional()
  @IsUrl()
  websiteUrl?: string;
}
