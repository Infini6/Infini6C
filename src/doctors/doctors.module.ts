import { Module } from '@nestjs/common';
import { DoctorsService } from './doctors.service.js';
import { DoctorsController } from './doctors.controller.js';

@Module({
  controllers: [DoctorsController],
  providers: [DoctorsService],
  exports: [DoctorsService],
})
export class DoctorsModule {}
