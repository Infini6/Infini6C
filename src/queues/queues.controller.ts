import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { QueuesService } from './queues.service.js';
import { CheckInDto } from './dto/check-in.dto.js';
import { SetPriorityDto } from './dto/set-priority.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/rbac.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { GetUser } from '../common/decorators/user.decorator.js';
import { Role } from '@prisma/client';

@ApiTags('Queues & Check-in')
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class QueuesController {
  constructor(private readonly queuesService: QueuesService) {}

  @Post('check-in')
  @Roles(Role.PATIENT, Role.HOSPITAL_ADMIN, Role.RECEPTIONIST)
  @ApiOperation({ summary: 'Check in a patient for their appointment' })
  async checkIn(@Body() dto: CheckInDto, @GetUser() user: any) {
    const result = await this.queuesService.checkIn(dto.appointmentId, user.userId, user.role);
    return {
      success: true,
      message: 'Patient checked-in and queued successfully',
      data: result,
    };
  }

  @Get('hospitals/:hospitalId/queues/:id')
  @ApiOperation({ summary: 'Get live state of a doctor\'s queue' })
  async getQueueState(
    @Param('hospitalId') hospitalId: string,
    @Param('id') id: string,
    @GetUser() user: any,
  ) {
    if (
      user.role !== Role.PLATFORM_ADMIN &&
      user.role !== Role.PATIENT &&
      user.hospitalId !== hospitalId
    ) {
      throw new ForbiddenException('Access denied: queue is outside your hospital scope');
    }

    const result = await this.queuesService.getQueueState(hospitalId, id);
    return { success: true, data: result };
  }

  @Post('hospitals/:hospitalId/queues/:id/call-next')
  @Roles(Role.PLATFORM_ADMIN, Role.HOSPITAL_ADMIN, Role.RECEPTIONIST, Role.QUEUE_OPERATOR, Role.DOCTOR)
  @ApiOperation({ summary: 'Call next patient from the waiting queue' })
  async callNext(
    @Param('hospitalId') hospitalId: string,
    @Param('id') id: string,
    @GetUser() user: any,
  ) {
    this.checkHospitalScope(user, hospitalId);
    const result = await this.queuesService.callNext(hospitalId, id, user.userId);
    return {
      success: true,
      message: 'Next patient called',
      data: result,
    };
  }

  @Post('hospitals/:hospitalId/queue-entries/:id/skip')
  @Roles(Role.PLATFORM_ADMIN, Role.HOSPITAL_ADMIN, Role.RECEPTIONIST, Role.QUEUE_OPERATOR, Role.DOCTOR)
  @ApiOperation({ summary: 'Skip the current patient and mark as skipped' })
  async skip(
    @Param('hospitalId') hospitalId: string,
    @Param('id') id: string,
    @GetUser() user: any,
  ) {
    this.checkHospitalScope(user, hospitalId);
    const result = await this.queuesService.skip(hospitalId, id, user.userId);
    return {
      success: true,
      message: 'Patient marked as skipped',
      data: result,
    };
  }

  @Post('hospitals/:hospitalId/queue-entries/:id/start')
  @Roles(Role.PLATFORM_ADMIN, Role.HOSPITAL_ADMIN, Role.QUEUE_OPERATOR, Role.DOCTOR)
  @ApiOperation({ summary: 'Start consultation for the called patient' })
  async start(
    @Param('hospitalId') hospitalId: string,
    @Param('id') id: string,
    @GetUser() user: any,
  ) {
    this.checkHospitalScope(user, hospitalId);
    const result = await this.queuesService.startConsultation(hospitalId, id, user.userId);
    return {
      success: true,
      message: 'Consultation started',
      data: result,
    };
  }

  @Post('hospitals/:hospitalId/queue-entries/:id/complete')
  @Roles(Role.PLATFORM_ADMIN, Role.HOSPITAL_ADMIN, Role.QUEUE_OPERATOR, Role.DOCTOR)
  @ApiOperation({ summary: 'Complete consultation for the active patient' })
  async complete(
    @Param('hospitalId') hospitalId: string,
    @Param('id') id: string,
    @GetUser() user: any,
  ) {
    this.checkHospitalScope(user, hospitalId);
    const result = await this.queuesService.completeConsultation(hospitalId, id, user.userId);
    return {
      success: true,
      message: 'Consultation completed',
      data: result,
    };
  }

  @Post('hospitals/:hospitalId/queue-entries/:id/priority')
  @Roles(Role.PLATFORM_ADMIN, Role.HOSPITAL_ADMIN, Role.RECEPTIONIST, Role.QUEUE_OPERATOR)
  @ApiOperation({ summary: 'Update priority level for a patient in the queue' })
  async setPriority(
    @Param('hospitalId') hospitalId: string,
    @Param('id') id: string,
    @Body() dto: SetPriorityDto,
    @GetUser() user: any,
  ) {
    this.checkHospitalScope(user, hospitalId);
    const result = await this.queuesService.setPriority(hospitalId, id, dto.priority, user.userId);
    return {
      success: true,
      message: 'Patient priority updated',
      data: result,
    };
  }

  private checkHospitalScope(user: any, hospitalId: string) {
    if (user.role !== Role.PLATFORM_ADMIN && user.hospitalId !== hospitalId) {
      throw new ForbiddenException('You are not authorized to perform actions in this hospital');
    }
  }
}
