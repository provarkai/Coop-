import { IsEnum, IsOptional, IsString } from 'class-validator';
import { MembershipStatus, Role } from '@prisma/client';

export class UpdateMembershipDto {
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsEnum(MembershipStatus)
  status?: MembershipStatus;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  membershipNumber?: string;
}
