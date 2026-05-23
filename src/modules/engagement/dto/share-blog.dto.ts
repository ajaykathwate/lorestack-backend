import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ShareBlogDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  channel?: string;
}
