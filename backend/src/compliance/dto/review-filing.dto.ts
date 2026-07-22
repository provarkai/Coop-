import { IsIn, IsOptional, IsString } from 'class-validator';

export class ReviewFilingDto {
  @IsIn(['APPROVED', 'REJECTED'])
  status: 'APPROVED' | 'REJECTED';

  @IsOptional()
  @IsString()
  reviewNotes?: string;
}
