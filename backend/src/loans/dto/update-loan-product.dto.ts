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

export class UpdateLoanProductDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  interestRatePercent?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  maxAmount?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  maxTermMonths?: number;

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
