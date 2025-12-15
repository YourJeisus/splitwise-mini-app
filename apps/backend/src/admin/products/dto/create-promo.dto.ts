import { IsBoolean, IsEnum, IsInt, IsObject, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

export class CreatePromoDto {
  @IsString()
  @MinLength(3)
  code!: string;

  @IsString()
  productCode!: string;

  @IsEnum(['PERCENT', 'FIXED_OVERRIDE'])
  discountType!: 'PERCENT' | 'FIXED_OVERRIDE';

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(99)
  percentOff?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  starsPriceOverride?: number;

  @IsOptional()
  @IsObject()
  priceBySettlementCurrencyOverride?: Record<string, number>;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxRedemptions?: number;

  @IsString()
  @MinLength(3)
  reason!: string;
}




