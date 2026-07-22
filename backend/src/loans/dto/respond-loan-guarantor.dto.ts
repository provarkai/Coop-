import { IsIn } from 'class-validator';

export class RespondLoanGuarantorDto {
  @IsIn(['APPROVED', 'DECLINED'])
  status: 'APPROVED' | 'DECLINED';
}
