import { IsArray, IsOptional, IsString } from 'class-validator';

export class CreateGroupDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  settlementCurrency?: string;

  @IsOptional()
  @IsString()
  homeCurrency?: string;

  @IsOptional()
  @IsArray()
  memberIds?: string[];
}

