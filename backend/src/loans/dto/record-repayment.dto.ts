import { IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class RecordRepaymentDto {
  @IsNumber()
  @IsPositive()
  amount: number;

  @IsOptional()
  @IsString()
  narration?: string;
}
