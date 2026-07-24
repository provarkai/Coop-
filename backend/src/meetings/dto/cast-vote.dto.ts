import { IsIn } from 'class-validator';

export class CastVoteDto {
  @IsIn(['FOR', 'AGAINST', 'ABSTAIN'])
  choice: 'FOR' | 'AGAINST' | 'ABSTAIN';
}
