import { IsBoolean, IsInt, IsObject, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  starsPrice?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  durationDays?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsObject()
  priceBySettlementCurrency?: Record<string, number>;

  @IsString()
  @MinLength(3)
  reason!: string;
}

