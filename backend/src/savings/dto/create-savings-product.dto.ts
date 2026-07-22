import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class CreateSavingsProductDto {
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

  @IsOptional()
  @IsNumber()
  @Min(0)
  minimumBalance?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
