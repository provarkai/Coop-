import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { DocumentCategory } from '@prisma/client';

export class CreateDocumentDto {
  @IsString()
  @MinLength(1)
  title: string;

  @IsOptional()
  @IsEnum(DocumentCategory)
  category?: DocumentCategory;

  @IsString()
  @MinLength(1)
  fileName: string;

  @IsString()
  @MinLength(1)
  mimeType: string;

  /** Base64-encoded file content (no data-URL prefix). Capped at ~7.5MB decoded. */
  @IsString()
  @MinLength(1)
  @MaxLength(10_000_000)
  contentBase64: string;
}
