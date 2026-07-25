import { Module } from '@nestjs/common';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { RegulatorAssignmentsModule } from '../regulator-assignments/regulator-assignments.module';
import { ContributionsModule } from '../contributions/contributions.module';
import { LandBankingController } from './land-banking.controller';
import { LandBankingService } from './land-banking.service';

@Module({
  imports: [AuditLogModule, RegulatorAssignmentsModule, ContributionsModule],
  controllers: [LandBankingController],
  providers: [LandBankingService],
  exports: [LandBankingService],
})
export class LandBankingModule {}
