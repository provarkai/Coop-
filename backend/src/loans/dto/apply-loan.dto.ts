import {
  IsInt,
  IsNumber,
  IsPositive,
  IsString,
  MinLength,
} from 'class-validator';

export class ApplyLoanDto {
  @IsString()
  @MinLength(1)
  productId: string;

  @IsNumber()
  @IsPositive()
  principal: number;

  @IsInt()
  @IsPositive()
  termMonths: number;
}
