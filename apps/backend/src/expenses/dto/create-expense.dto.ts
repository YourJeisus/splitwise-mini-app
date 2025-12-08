import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

class ExpenseShareInput {
  @IsString()
  userId!: string;

  @IsNumber()
  paid!: number;

  @IsNumber()
  owed!: number;
}

export class CreateExpenseDto {
  @IsOptional()
  @IsString()
  groupId?: string;

  @IsString()
  description!: string;

  @IsNumber()
  amount!: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExpenseShareInput)
  shares!: ExpenseShareInput[];
}

