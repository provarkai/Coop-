import { IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateCooperativeLogoDto {
  @IsString()
  @MinLength(1)
  mimeType: string;

  /** Base64-encoded image content (no data-URL prefix). Capped at ~3MB decoded. */
  @IsString()
  @MinLength(1)
  @MaxLength(4_000_000)
  contentBase64: string;
}
