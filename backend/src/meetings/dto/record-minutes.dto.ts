import { IsString, MinLength } from 'class-validator';

export class RecordMinutesDto {
  @IsString()
  @MinLength(1)
  minutes: string;
}
