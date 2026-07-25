import { IsOptional, IsString } from 'class-validator';

export class VerifyMilestoneDto {
  @IsOptional()
  @IsString()
  proofNotes?: string;
}
