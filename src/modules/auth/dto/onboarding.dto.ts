import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class OnboardingDto {
  @ApiProperty({ example: 'Ajay Kathwate' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  displayName: string;

  @ApiProperty({
    required: false,
    example: 'ajay-kathwate',
    description:
      'Lowercase letters, numbers, hyphens, underscores. Must start with a letter or number. Auto-generated if omitted.',
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  @Matches(/^[a-z0-9][a-z0-9_-]*$/, {
    message:
      'Username may only contain lowercase letters, numbers, hyphens, and underscores, and must start with a letter or number.',
  })
  username?: string;
}
