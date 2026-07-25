import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { RegulatorAssignmentsModule } from '../regulator-assignments/regulator-assignments.module';
import { SyndicationController } from './syndication.controller';
import { SyndicationService } from './syndication.service';

@Module({
  imports: [UsersModule, AuditLogModule, RegulatorAssignmentsModule],
  controllers: [SyndicationController],
  providers: [SyndicationService],
  exports: [SyndicationService],
})
export class SyndicationModule {}
