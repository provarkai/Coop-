import {
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { ContributionFrequency, ContributionGroupType } from '@prisma/client';

export class CreateContributionGroupDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsEnum(ContributionGroupType)
  type: ContributionGroupType;

  @IsEmail()
  coordinatorEmail: string;

  @IsNumber()
  @Min(0)
  contributionAmount: number;

  @IsEnum(ContributionFrequency)
  frequency: ContributionFrequency;

  @IsOptional()
  @IsNumber()
  @Min(0)
  targetAmount?: number;
}
