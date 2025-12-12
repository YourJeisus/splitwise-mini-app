import { IsBoolean, IsString } from "class-validator";

export class CreateTripPassInvoiceDto {
  @IsString()
  groupId!: string;

  @IsBoolean()
  splitCost!: boolean;
}


