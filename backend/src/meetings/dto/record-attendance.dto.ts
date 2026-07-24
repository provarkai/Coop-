import { IsIn } from 'class-validator';

export class RecordAttendanceDto {
  @IsIn(['ATTENDED', 'ABSENT', 'EXCUSED'])
  status: 'ATTENDED' | 'ABSENT' | 'EXCUSED';
}
