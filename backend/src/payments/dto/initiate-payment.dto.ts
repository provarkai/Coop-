import {
  IsIn,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MinLength,
} from 'class-validator';

export class InitiatePaymentDto {
  @IsIn(['SAVINGS_DEPOSIT', 'LOAN_REPAYMENT'])
  purpose: 'SAVINGS_DEPOSIT' | 'LOAN_REPAYMENT';

  @IsString()
  @MinLength(1)
  targetId: string;

  @IsNumber()
  @IsPositive()
  amount: number;

  @IsOptional()
  @IsString()
  narration?: string;
}
