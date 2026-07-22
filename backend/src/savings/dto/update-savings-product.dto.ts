import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateSavingsProductDto {
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
  @Min(0)
  minimumBalance?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
