import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class ReadProgressDto {
  @IsString()
  @MaxLength(64)
  sessionId: string;

  @IsInt()
  @Min(0)
  @Max(100)
  maxScrollDepth: number;

  @IsInt()
  @Min(0)
  readDurationSeconds: number;

  @IsOptional()
  @IsBoolean()
  completed?: boolean;
}
