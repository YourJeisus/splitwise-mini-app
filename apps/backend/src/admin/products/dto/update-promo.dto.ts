import { IsBoolean, IsInt, IsObject, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

export class UpdatePromoDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(99)
  percentOff?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  starsPriceOverride?: number | null;

  @IsOptional()
  @IsObject()
  priceBySettlementCurrencyOverride?: Record<string, number> | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxRedemptions?: number | null;

  @IsString()
  @MinLength(3)
  reason!: string;
}




