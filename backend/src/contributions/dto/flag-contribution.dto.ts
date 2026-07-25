import { IsEnum } from 'class-validator';
import { ContributionStatus } from '@prisma/client';

export class FlagContributionDto {
  @IsEnum([ContributionStatus.LATE, ContributionStatus.DEFAULTED])
  status: typeof ContributionStatus.LATE | typeof ContributionStatus.DEFAULTED;
}
