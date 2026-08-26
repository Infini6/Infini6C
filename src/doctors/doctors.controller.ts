import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { DoctorsService } from './doctors.service.js';
import { CreateDoctorDto, UpdateDoctorDto } from './dto/create-doctor.dto.js';
import { DoctorAvailabilityDto } from './dto/availability.dto.js';
import { DoctorOverrideDto } from './dto/override.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/rbac.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { GetUser } from '../common/decorators/user.decorator.js';
import { Role } from '@prisma/client';

@ApiTags('Doctors')
@Controller('hospitals/:hospitalId/doctors')
export class DoctorsController {
  constructor(private readonly doctorsService: DoctorsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PLATFORM_ADMIN, Role.HOSPITAL_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Register a new doctor (Admin only)' })
  async create(
    @Param('hospitalId') hospitalId: string,
    @Body() dto: CreateDoctorDto,
    @GetUser() user: any,
  ) {
    this.checkHospitalAdminScope(user, hospitalId);
    const result = await this.doctorsService.create(hospitalId, dto);
    return {
      success: true,
      message: 'Doctor registered successfully',
      data: result,
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get list of doctors in a hospital' })
  @ApiQuery({ name: 'departmentId', required: false, type: String })
  async findAll(
    @Param('hospitalId') hospitalId: string,
    @Query('departmentId') departmentId?: string,
  ) {
    const result = await this.doctorsService.findByHospital(hospitalId, departmentId);
    return { success: true, data: result };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get details of a specific doctor' })
  async findOne(
    @Param('hospitalId') hospitalId: string,
    @Param('id') id: string,
  ) {
    const result = await this.doctorsService.findOne(id, hospitalId);
    return { success: true, data: result };
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PLATFORM_ADMIN, Role.HOSPITAL_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update doctor status / profile' })
  async update(
    @Param('hospitalId') hospitalId: string,
    @Param('id') id: string,
    @Body() dto: UpdateDoctorDto,
    @GetUser() user: any,
  ) {
    this.checkHospitalAdminScope(user, hospitalId);
    const result = await this.doctorsService.update(id, hospitalId, dto);
    return {
      success: true,
      message: 'Doctor updated successfully',
      data: result,
    };
  }

  @Post(':id/availability')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PLATFORM_ADMIN, Role.HOSPITAL_ADMIN, Role.DOCTOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Set doctor weekly availability' })
  async setAvailability(
    @Param('hospitalId') hospitalId: string,
    @Param('id') id: string,
    @Body() dto: DoctorAvailabilityDto,
    @GetUser() user: any,
  ) {
    this.checkDoctorSelfOrAdminScope(user, hospitalId, id);
    const result = await this.doctorsService.setAvailability(id, hospitalId, dto);
    return {
      success: true,
      message: 'Weekly availability updated successfully',
      data: result,
    };
  }

  @Post(':id/overrides')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PLATFORM_ADMIN, Role.HOSPITAL_ADMIN, Role.DOCTOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Set doctor date-specific overrides' })
  async addOverride(
    @Param('hospitalId') hospitalId: string,
    @Param('id') id: string,
    @Body() dto: DoctorOverrideDto,
    @GetUser() user: any,
  ) {
    this.checkDoctorSelfOrAdminScope(user, hospitalId, id);
    const result = await this.doctorsService.addOverride(id, hospitalId, dto);
    return {
      success: true,
      message: 'Doctor availability override set successfully',
      data: result,
    };
  }

  @Post(':id/unavailability')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PLATFORM_ADMIN, Role.HOSPITAL_ADMIN, Role.DOCTOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Declare doctor unavailability for a date and trigger substitution/rescheduling' })
  async declareUnavailability(
    @Param('hospitalId') hospitalId: string,
    @Param('id') id: string,
    @Body() dto: DoctorOverrideDto,
    @GetUser() user: any,
  ) {
    this.checkDoctorSelfOrAdminScope(user, hospitalId, id);
    const result = await this.doctorsService.declareUnavailability(hospitalId, id, dto, user.userId);
    return result;
  }

  private checkHospitalAdminScope(user: any, hospitalId: string) {
    if (user.role === Role.HOSPITAL_ADMIN && user.hospitalId !== hospitalId) {
      throw new ForbiddenException('You are not authorized to manage doctors in this hospital');
    }
  }

  private checkDoctorSelfOrAdminScope(user: any, hospitalId: string, doctorId: string) {
    if (user.role === Role.PLATFORM_ADMIN) return;

    if (user.role === Role.HOSPITAL_ADMIN) {
      if (user.hospitalId !== hospitalId) {
        throw new ForbiddenException('You are not authorized to manage doctors in this hospital');
      }
      return;
    }

    if (user.role === Role.DOCTOR) {
      if (user.doctorId !== doctorId) {
        throw new ForbiddenException('You are not authorized to modify another doctor availability');
      }
      return;
    }

    throw new ForbiddenException('Action forbidden');
  }
}
