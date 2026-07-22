import { IsEmail } from 'class-validator';

export class AddLoanGuarantorDto {
  @IsEmail()
  email: string;
}
