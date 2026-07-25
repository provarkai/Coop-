import { IsEmail } from 'class-validator';

export class AddGroupMemberDto {
  @IsEmail()
  email: string;
}
