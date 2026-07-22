import { IsEmail, IsOptional, IsString } from 'class-validator';

export class AddCommitteeMemberDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  title?: string;
}
