import {
  IsIn,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';

export class RecordSavingsTransactionDto {
  @IsIn(['DEPOSIT', 'WITHDRAWAL'])
  type: 'DEPOSIT' | 'WITHDRAWAL';

  @IsNumber()
  @IsPositive()
  amount: number;

  @IsOptional()
  @IsString()
  narration?: string;
}
