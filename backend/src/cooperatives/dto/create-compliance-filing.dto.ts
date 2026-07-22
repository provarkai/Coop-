import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { ComplianceFilingType } from '@prisma/client';

export class CreateComplianceFilingDto {
  @IsEnum(ComplianceFilingType)
  type: ComplianceFilingType;

  @IsString()
  @MinLength(1)
  period: string;

  @IsString()
  @MinLength(1)
  title: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  documentUrl?: string;
}
