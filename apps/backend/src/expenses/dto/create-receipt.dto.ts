import { IsString, IsNumber, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class ReceiptItemDto {
  @IsString()
  name!: string;

  @IsNumber()
  quantity!: number;

  @IsNumber()
  totalPrice!: number;

  @IsOptional()
  @IsNumber()
  unitPrice?: number;
}

class MyClaimDto {
  @IsNumber()
  itemIndex!: number;

  @IsNumber()
  quantity!: number;
}

export class CreateReceiptDto {
  @IsString()
  groupId!: string;

  @IsString()
  description!: string;

  @IsNumber()
  totalAmount!: number;

  @IsString()
  currency!: string;

  @IsOptional()
  @IsString()
  date?: string;

  @IsString()
  paidByUserId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceiptItemDto)
  items!: ReceiptItemDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MyClaimDto)
  myClaims?: MyClaimDto[];
}

class ClaimDto {
  @IsString()
  itemId!: string;

  @IsNumber()
  quantity!: number;
}

export class ClaimReceiptItemsDto {
  @IsString()
  receiptId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ClaimDto)
  claims!: ClaimDto[];

  @IsOptional()
  @IsString()
  forUserId?: string;
}
