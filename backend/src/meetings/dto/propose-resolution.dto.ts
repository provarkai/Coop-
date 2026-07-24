import { IsOptional, IsString, MinLength } from 'class-validator';

export class ProposeResolutionDto {
  @IsOptional()
  @IsString()
  agendaItemId?: string;

  @IsString()
  @MinLength(1)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;
}
