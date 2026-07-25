import { IsString, MaxLength, MinLength } from 'class-validator';

export class GenerateCustomReportDto {
  // e.g. "Loan delinquency report for this quarter" or "Member growth and savings trend report"
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  prompt: string;
}
