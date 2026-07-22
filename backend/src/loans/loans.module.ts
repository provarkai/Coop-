import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { LoansController } from './loans.controller';
import { LoansService } from './loans.service';

@Module({
  imports: [UsersModule],
  controllers: [LoansController],
  providers: [LoansService],
})
export class LoansModule {}
