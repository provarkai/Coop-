import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { CooperativesController } from './cooperatives.controller';
import { CooperativesService } from './cooperatives.service';

@Module({
  imports: [UsersModule, AuditLogModule],
  controllers: [CooperativesController],
  providers: [CooperativesService],
})
export class CooperativesModule {}
