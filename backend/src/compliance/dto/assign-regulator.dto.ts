import { IsEmail, IsString } from 'class-validator';

export class AssignRegulatorDto {
  @IsString()
  cooperativeId: string;

  @IsEmail()
  regulatorEmail: string;
}
