import { IsIn } from 'class-validator';

export class RsvpDto {
  @IsIn(['CONFIRMED', 'DECLINED'])
  status: 'CONFIRMED' | 'DECLINED';
}
