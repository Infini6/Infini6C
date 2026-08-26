import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { HospitalsService } from './hospitals.service.js';
import { CreateHospitalDto, UpdateHospitalDto } from './dto/create-hospital.dto.js';
import { SetOperatingHoursDto } from './dto/operating-hours.dto.js';
import { CreateClosureDto } from './dto/closure.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/rbac.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { GetUser } from '../common/decorators/user.decorator.js';
import { Role } from '@prisma/client';

@ApiTags('Hospitals')
@Controller('hospitals')
export class HospitalsController {
  constructor(private readonly hospitalsService: HospitalsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PLATFORM_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Register a new hospital (Platform Admin only)' })
  async create(@Body() dto: CreateHospitalDto) {
    const result = await this.hospitalsService.create(dto);
    return {
      success: true,
      message: 'Hospital registered successfully',
      data: result,
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get list of active hospitals' })
  async findAll(@GetUser() user: any) {
    if (user && user.role === Role.PLATFORM_ADMIN) {
      const result = await this.hospitalsService.findAll();
      return { success: true, data: result };
    }
    const result = await this.hospitalsService.findAllActive();
    return { success: true, data: result };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get details of a specific hospital' })
  async findOne(@Param('id') id: string) {
    const result = await this.hospitalsService.findOne(id);
    return { success: true, data: result };
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PLATFORM_ADMIN, Role.HOSPITAL_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update hospital details (Platform Admin or Hospital Admin)' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateHospitalDto,
    @GetUser() user: any,
  ) {
    if (user.role === Role.HOSPITAL_ADMIN && user.hospitalId !== id) {
      throw new ForbiddenException('You are not authorized to manage this hospital');
    }

    const result = await this.hospitalsService.update(id, dto);
    return {
      success: true,
      message: 'Hospital details updated successfully',
      data: result,
    };
  }

  @Post(':id/operating-hours')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PLATFORM_ADMIN, Role.HOSPITAL_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Set or update hospital operating hours' })
  async setOperatingHours(
    @Param('id') id: string,
    @Body() dto: SetOperatingHoursDto,
    @GetUser() user: any,
  ) {
    if (user.role === Role.HOSPITAL_ADMIN && user.hospitalId !== id) {
      throw new ForbiddenException('You are not authorized to manage this hospital');
    }

    const result = await this.hospitalsService.setOperatingHours(id, dto);
    return {
      success: true,
      message: 'Operating hours updated successfully',
      data: result,
    };
  }

  @Post(':id/closures')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PLATFORM_ADMIN, Role.HOSPITAL_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Register a hospital closure / holiday' })
  async addClosure(
    @Param('id') id: string,
    @Body() dto: CreateClosureDto,
    @GetUser() user: any,
  ) {
    if (user.role === Role.HOSPITAL_ADMIN && user.hospitalId !== id) {
      throw new ForbiddenException('You are not authorized to manage this hospital');
    }

    const result = await this.hospitalsService.addClosure(id, dto);
    return {
      success: true,
      message: 'Hospital closure registered successfully',
      data: result,
    };
  }
}
