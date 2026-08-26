import { Module, Global } from '@nestjs/common';
import { AuditingService } from './auditing.service.js';
import { AuditingController } from './auditing.controller.js';

@Global()
@Module({
  controllers: [AuditingController],
  providers: [AuditingService],
  exports: [AuditingService],
})
export class AuditingModule {}
