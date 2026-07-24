import { Module } from '@nestjs/common';
import { RegulatorAssignmentsService } from './regulator-assignments.service';

@Module({
  providers: [RegulatorAssignmentsService],
  exports: [RegulatorAssignmentsService],
})
export class RegulatorAssignmentsModule {}
