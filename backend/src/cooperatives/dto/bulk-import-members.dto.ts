import { IsString, MinLength } from 'class-validator';

export class BulkImportMembersDto {
  // Raw CSV text: header row `firstName,lastName,email,role,category`
  // (role/category optional, default to MEMBER/ORDINARY).
  @IsString()
  @MinLength(1)
  csvContent: string;
}
