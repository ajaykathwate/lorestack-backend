import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class SendEmailDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  to: string;

  @ApiProperty({ example: 'Hello from Lorestack' })
  @IsString()
  @MinLength(1)
  subject: string;

  @ApiProperty({ example: '<p>Hello world</p>' })
  @IsString()
  @MinLength(1)
  html: string;
}
