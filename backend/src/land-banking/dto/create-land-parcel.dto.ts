import {
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class CreateLandParcelDto {
  @IsString()
  @MinLength(1)
  location: string;

  @IsOptional()
  @IsString()
  coordinatesMinna?: string;

  @IsOptional()
  @IsString()
  coordinatesWgs84?: string;

  @IsNumber()
  @Min(0)
  priceNaira: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  sizeSqm?: number;

  @IsOptional()
  @IsString()
  titleStatus?: string;

  @IsOptional()
  @IsString()
  disputeCheckNotes?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  verificationScore?: number;
}
