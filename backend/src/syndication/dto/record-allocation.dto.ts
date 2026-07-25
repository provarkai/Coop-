import {
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class RecordAllocationDto {
  @IsEmail()
  memberEmail: string;

  @IsString()
  @MinLength(1)
  plotRef: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  documentIds?: string[];
}
