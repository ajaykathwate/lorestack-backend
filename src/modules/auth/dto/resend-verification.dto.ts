import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail } from 'class-validator';

export class ResendVerificationDto {
  @ApiProperty({ example: 'ajay@example.com' })
  @Transform(({ value }: { value: string }) => value?.toLowerCase()?.trim())
  @IsEmail()
  identifier: string;
}
