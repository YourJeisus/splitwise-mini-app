import { IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateSettlementDto {
  @IsString()
  toUserId!: string;

  @IsNumber()
  amount!: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

