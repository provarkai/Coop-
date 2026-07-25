import { IsDateString, IsNumber, IsOptional, Min } from 'class-validator';

// Creates one PENDING Contribution per active group member for this due
// date -- the digital equivalent of the coordinator opening a new page in
// the paper register for this period.
export class RecordContributionPeriodDto {
  @IsDateString()
  dueDate: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;
}
