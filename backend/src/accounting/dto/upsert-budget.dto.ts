import { IsNumber, IsPositive, IsString, MinLength } from 'class-validator';

export class UpsertBudgetDto {
  @IsString()
  @MinLength(1)
  accountId: string;

  @IsString()
  @MinLength(1)
  period: string;

  @IsNumber()
  @IsPositive()
  plannedAmount: number;
}
