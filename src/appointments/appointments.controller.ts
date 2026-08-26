import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AppointmentsService } from './appointments.service.js';
import { CreateAppointmentDto } from './dto/create-appointment.dto.js';
import { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/rbac.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { GetUser } from '../common/decorators/user.decorator.js';
import { Role } from '@prisma/client';

@ApiTags('Appointments')
@Controller('appointments')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Post()
  @Roles(Role.PATIENT, Role.HOSPITAL_ADMIN, Role.RECEPTIONIST)
  @ApiOperation({ summary: 'Book a new appointment' })
  async create(@Body() dto: CreateAppointmentDto, @GetUser() user: any) {
    let targetPatientId = dto.patientId;

    if (user.role === Role.PATIENT) {
      if (!user.patientId) {
        throw new ForbiddenException('Patient profile is not fully registered');
      }
      targetPatientId = user.patientId;
    } else {
      if (!targetPatientId) {
        throw new BadRequestException('patientId is required for staff bookings');
      }
      if (user.role === Role.HOSPITAL_ADMIN || user.role === Role.RECEPTIONIST) {
        if (user.hospitalId !== dto.hospitalId) {
          throw new ForbiddenException('You can only book appointments for your own hospital');
        }
      }
    }

    if (!targetPatientId) {
      throw new BadRequestException('patientId is required');
    }

    const result = await this.appointmentsService.create(targetPatientId, dto);
    return {
      success: true,
      message: 'Appointment booked successfully',
      data: result,
    };
  }

  @Get()
  @ApiOperation({ summary: 'List appointments (role-scoped and filtered)' })
  @ApiQuery({ name: 'hospitalId', required: false, type: String })
  @ApiQuery({ name: 'doctorId', required: false, type: String })
  @ApiQuery({ name: 'date', required: false, type: String, description: 'YYYY-MM-DD' })
  async findAll(
    @GetUser() user: any,
    @Query('hospitalId') hospitalId?: string,
    @Query('doctorId') doctorId?: string,
    @Query('date') date?: string,
  ) {
    const params: any = { hospitalId, doctorId, date };

    if (user.role === Role.PATIENT) {
      params.patientId = user.patientId;
    } else if (user.role === Role.DOCTOR) {
      params.doctorId = user.doctorId;
      params.hospitalId = user.hospitalId;
    } else if (user.role === Role.HOSPITAL_ADMIN || user.role === Role.RECEPTIONIST || user.role === Role.QUEUE_OPERATOR || user.role === Role.LAB_OPERATOR || user.role === Role.SCAN_OPERATOR) {
      params.hospitalId = user.hospitalId;
    }

    const result = await this.appointmentsService.findAll(params);
    return { success: true, data: result };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get details of a specific appointment' })
  async findOne(@Param('id') id: string, @GetUser() user: any) {
    const result = await this.appointmentsService.findOne(id);
    this.checkScope(user, result);
    return { success: true, data: result };
  }

  @Post(':id/cancel')
  @Roles(Role.PATIENT, Role.HOSPITAL_ADMIN, Role.RECEPTIONIST, Role.DOCTOR)
  @ApiOperation({ summary: 'Cancel an appointment' })
  async cancel(@Param('id') id: string, @GetUser() user: any) {
    const result = await this.appointmentsService.cancel(id, user.userId, user.role);
    return {
      success: true,
      message: 'Appointment cancelled successfully',
      data: result,
    };
  }

  @Post(':id/reschedule')
  @Roles(Role.PATIENT, Role.HOSPITAL_ADMIN, Role.RECEPTIONIST)
  @ApiOperation({ summary: 'Reschedule an appointment' })
  async reschedule(
    @Param('id') id: string,
    @Body() dto: RescheduleAppointmentDto,
    @GetUser() user: any,
  ) {
    const result = await this.appointmentsService.reschedule(id, dto, user.userId, user.role);
    return {
      success: true,
      message: 'Appointment rescheduled successfully',
      data: result,
    };
  }

  private checkScope(user: any, appointment: any) {
    if (user.role === Role.PLATFORM_ADMIN) return;

    if (user.role === Role.PATIENT) {
      if (appointment.patientId !== user.patientId) {
        throw new ForbiddenException('Access denied: you do not own this appointment');
      }
      return;
    }

    if (user.role === Role.DOCTOR) {
      if (appointment.doctorId !== user.doctorId) {
        throw new ForbiddenException('Access denied: this appointment is not assigned to you');
      }
      return;
    }

    if (appointment.hospitalId !== user.hospitalId) {
      throw new ForbiddenException('Access denied: this appointment belongs to another hospital');
    }
  }
}
