import {
  IsString,
  IsOptional,
  IsBoolean,
  Matches,
  MinLength,
  MaxLength,
} from "class-validator";

export class CreateTrackingLinkDto {
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message:
      "Code must contain only letters, numbers, underscores, and hyphens",
  })
  code!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsString()
  reason!: string;
}
