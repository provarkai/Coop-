import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class CreateLoanProductDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsString()
  @MinLength(1)
  code: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  interestRatePercent?: number;

  @IsNumber()
  @IsPositive()
  maxAmount: number;

  @IsInt()
  @IsPositive()
  maxTermMonths: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  penaltyRatePercent?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  requiredGuarantors?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
