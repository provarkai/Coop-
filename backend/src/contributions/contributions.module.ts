import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { RegulatorAssignmentsModule } from '../regulator-assignments/regulator-assignments.module';
import { ContributionsController } from './contributions.controller';
import { ContributionsService } from './contributions.service';

@Module({
  imports: [UsersModule, AuditLogModule, RegulatorAssignmentsModule],
  controllers: [ContributionsController],
  providers: [ContributionsService],
  exports: [ContributionsService],
})
export class ContributionsModule {}
