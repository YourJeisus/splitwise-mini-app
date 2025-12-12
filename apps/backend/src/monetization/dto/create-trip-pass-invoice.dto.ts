import { IsBoolean, IsOptional, IsString } from "class-validator";

export class CreateTripPassInvoiceDto {
  @IsString()
  groupId!: string;

  @IsBoolean()
  splitCost!: boolean;

  @IsOptional()
  @IsString()
  promoCode?: string;
}


