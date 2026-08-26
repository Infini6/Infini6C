import { Module } from '@nestjs/common';
import { PatientJourneyService } from './patient-journey.service.js';
import { PatientJourneyController } from './patient-journey.controller.js';

@Module({
  controllers: [PatientJourneyController],
  providers: [PatientJourneyService],
  exports: [PatientJourneyService],
})
export class PatientJourneyModule {}
