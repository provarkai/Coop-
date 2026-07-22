import { IsOptional, IsString } from 'class-validator';

export class RejectLoanDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
