import { IsOptional, IsString } from 'class-validator';

export class ApplyDto {
  @IsOptional()
  @IsString()
  category?: string;
}
