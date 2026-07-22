import { IsIn } from 'class-validator';

export class RespondGuarantorDto {
  @IsIn(['APPROVED', 'DECLINED'])
  status: 'APPROVED' | 'DECLINED';
}
