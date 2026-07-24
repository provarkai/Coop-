import { Module } from '@nestjs/common';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { RegulatorAssignmentsModule } from '../regulator-assignments/regulator-assignments.module';
import { ReportsModule } from '../reports/reports.module';
import { MeetingsModule } from '../meetings/meetings.module';
import { ComplianceController } from './compliance.controller';
import { ComplianceService } from './compliance.service';

@Module({
  imports: [
    AuditLogModule,
    RegulatorAssignmentsModule,
    ReportsModule,
    MeetingsModule,
  ],
  controllers: [ComplianceController],
  providers: [ComplianceService],
})
export class ComplianceModule {}
