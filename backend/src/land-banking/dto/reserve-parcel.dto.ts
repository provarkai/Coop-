import { IsString, MinLength } from 'class-validator';

export class ReserveParcelDto {
  @IsString()
  @MinLength(1)
  groupId: string;
}
