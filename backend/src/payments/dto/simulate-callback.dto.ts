import { IsIn } from 'class-validator';

export class SimulateCallbackDto {
  @IsIn(['SUCCESS', 'FAILED'])
  outcome: 'SUCCESS' | 'FAILED';
}
