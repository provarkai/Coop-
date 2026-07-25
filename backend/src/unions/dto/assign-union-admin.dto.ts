import { IsEmail } from 'class-validator';

export class AssignUnionAdminDto {
  @IsEmail()
  email: string;
}
