import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PatientJourneyService } from './patient-journey.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/rbac.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { GetUser } from '../common/decorators/user.decorator.js';
import { Role } from '@prisma/client';

@ApiTags('Patient Journey')
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class PatientJourneyController {
  constructor(private readonly journeyService: PatientJourneyService) {}

  @Get('appointments/:appointmentId/journey')
  @ApiOperation({ summary: 'Get current patient journey for an appointment' })
  async getJourney(
    @Param('appointmentId') appointmentId: string,
    @GetUser() user: any,
  ) {
    const journey: any = await this.journeyService.getJourneyByAppointment(appointmentId);
    
    if (user.role === Role.PATIENT && journey.patientId !== user.patientId) {
      throw new ForbiddenException('Access denied: you do not own this journey');
    }
    if (
      user.role !== Role.PLATFORM_ADMIN &&
      user.role !== Role.PATIENT &&
      journey.appointment.hospitalId !== user.hospitalId
    ) {
      throw new ForbiddenException('Access denied: journey is outside your hospital');
    }

    return { success: true, data: journey };
  }

  @Post('journeys/:journeyId/steps/:stepId/advance')
  @Roles(Role.PLATFORM_ADMIN, Role.HOSPITAL_ADMIN, Role.RECEPTIONIST, Role.QUEUE_OPERATOR, Role.LAB_OPERATOR, Role.SCAN_OPERATOR, Role.DOCTOR)
  @ApiOperation({ summary: 'Advance journey step (Staff only)' })
  async advanceStep(
    @Param('journeyId') journeyId: string,
    @Param('stepId') stepId: string,
    @GetUser() user: any,
  ) {
    const result = await this.journeyService.advanceStep(journeyId, stepId, user.userId);
    return {
      success: true,
      message: 'Journey step advanced successfully',
      data: result,
    };
  }
}
