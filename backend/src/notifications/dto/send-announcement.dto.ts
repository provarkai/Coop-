import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { NotificationChannel } from '@prisma/client';

export class SendAnnouncementDto {
  @IsEnum(NotificationChannel)
  channel: NotificationChannel;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsString()
  @MinLength(1)
  body: string;
}
