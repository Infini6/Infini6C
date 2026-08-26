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
import { StaffService } from './staff.service.js';
import { CreateStaffDto, UpdateStaffDto } from './dto/create-staff.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/rbac.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { GetUser } from '../common/decorators/user.decorator.js';
import { Role } from '@prisma/client';

@ApiTags('Hospital Staff')
@Controller('hospitals/:hospitalId/staff')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.PLATFORM_ADMIN, Role.HOSPITAL_ADMIN)
@ApiBearerAuth()
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Post()
  @ApiOperation({ summary: 'Register a new staff member (Admin only)' })
  async create(
    @Param('hospitalId') hospitalId: string,
    @Body() dto: CreateStaffDto,
    @GetUser() user: any,
  ) {
    this.checkScope(user, hospitalId);
    const result = await this.staffService.create(hospitalId, dto);
    return {
      success: true,
      message: 'Staff member registered successfully',
      data: result,
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get list of staff members in a hospital' })
  async findAll(
    @Param('hospitalId') hospitalId: string,
    @GetUser() user: any,
  ) {
    this.checkScope(user, hospitalId);
    const result = await this.staffService.findByHospital(hospitalId);
    return { success: true, data: result };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get details of a specific staff member' })
  async findOne(
    @Param('hospitalId') hospitalId: string,
    @Param('id') id: string,
    @GetUser() user: any,
  ) {
    this.checkScope(user, hospitalId);
    const result = await this.staffService.findOne(id, hospitalId);
    return { success: true, data: result };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update staff member profile / role' })
  async update(
    @Param('hospitalId') hospitalId: string,
    @Param('id') id: string,
    @Body() dto: UpdateStaffDto,
    @GetUser() user: any,
  ) {
    this.checkScope(user, hospitalId);
    const result = await this.staffService.update(id, hospitalId, dto);
    return {
      success: true,
      message: 'Staff member updated successfully',
      data: result,
    };
  }

  private checkScope(user: any, hospitalId: string) {
    if (user.role === Role.HOSPITAL_ADMIN && user.hospitalId !== hospitalId) {
      throw new ForbiddenException('You are not authorized to manage staff in this hospital');
    }
  }
}
