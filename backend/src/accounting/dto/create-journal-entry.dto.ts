import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class JournalLineDto {
  @IsString()
  @MinLength(1)
  accountId: string;

  @IsOptional()
  @Min(0)
  debit?: number;

  @IsOptional()
  @Min(0)
  credit?: number;
}

export class CreateJournalEntryDto {
  @IsOptional()
  @IsString()
  memo?: string;

  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => JournalLineDto)
  lines: JournalLineDto[];
}
