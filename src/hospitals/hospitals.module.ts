import { Module } from '@nestjs/common';
import { HospitalsService } from './hospitals.service.js';
import { HospitalsController } from './hospitals.controller.js';

@Module({
  controllers: [HospitalsController],
  providers: [HospitalsService],
  exports: [HospitalsService],
})
export class HospitalsModule {}
