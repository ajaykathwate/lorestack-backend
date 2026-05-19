import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class ResendVerificationDto {
  @ApiProperty({ example: 'ajay@example.com' })
  @IsString()
  identifier: string;
}
