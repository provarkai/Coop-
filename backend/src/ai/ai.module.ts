import { Module } from '@nestjs/common';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { AccountingModule } from '../accounting/accounting.module';
import { RegulatorAssignmentsModule } from '../regulator-assignments/regulator-assignments.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AiClientService } from './ai-client.service';

@Module({
  imports: [AuditLogModule, AccountingModule, RegulatorAssignmentsModule],
  controllers: [AiController],
  providers: [AiService, AiClientService],
  exports: [AiService],
})
export class AiModule {}
