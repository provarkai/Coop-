import { Module } from '@nestjs/common';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { AccountingModule } from '../accounting/accounting.module';
import { RegulatorAssignmentsModule } from '../regulator-assignments/regulator-assignments.module';
import { SavingsController } from './savings.controller';
import { SavingsService } from './savings.service';

@Module({
  imports: [AuditLogModule, AccountingModule, RegulatorAssignmentsModule],
  controllers: [SavingsController],
  providers: [SavingsService],
  exports: [SavingsService],
})
export class SavingsModule {}
