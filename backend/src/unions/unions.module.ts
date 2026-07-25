import { Module } from '@nestjs/common';
import { UnionsController } from './unions.controller';
import { UnionsService } from './unions.service';

@Module({
  controllers: [UnionsController],
  providers: [UnionsService],
  exports: [UnionsService],
})
export class UnionsModule {}
