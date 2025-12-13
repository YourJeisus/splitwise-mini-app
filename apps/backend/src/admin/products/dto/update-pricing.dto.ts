import { IsBoolean, IsEnum, IsInt, IsObject, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

export class UpdatePricingDto {
  @IsOptional()
  @IsEnum(['NONE', 'PERCENT', 'FIXED_OVERRIDE'])
  globalDiscountType?: 'NONE' | 'PERCENT' | 'FIXED_OVERRIDE';

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
  @IsBoolean()
  enabled?: boolean;

  @IsString()
  @MinLength(3)
  reason!: string;
}


