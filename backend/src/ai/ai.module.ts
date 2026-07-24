import { Module } from '@nestjs/common';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AiClientService } from './ai-client.service';

@Module({
  imports: [AuditLogModule],
  controllers: [AiController],
  providers: [AiService, AiClientService],
  exports: [AiService],
})
export class AiModule {}
