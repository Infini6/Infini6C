import { Module } from '@nestjs/common';
import { QueuesService } from './queues.service.js';
import { QueuesController } from './queues.controller.js';

@Module({
  controllers: [QueuesController],
  providers: [QueuesService],
  exports: [QueuesService],
})
export class QueuesModule {}
