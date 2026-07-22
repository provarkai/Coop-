import { IsString, MinLength } from 'class-validator';

export class OpenSavingsAccountDto {
  @IsString()
  @MinLength(1)
  productId: string;
}
