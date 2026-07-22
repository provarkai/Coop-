import { IsEmail } from 'class-validator';

export class AddGuarantorDto {
  @IsEmail()
  email: string;
}
