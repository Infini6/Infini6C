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
import { DepartmentsService } from './departments.service.js';
import { CreateDepartmentDto, UpdateDepartmentDto } from './dto/create-department.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/rbac.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { GetUser } from '../common/decorators/user.decorator.js';
import { Role } from '@prisma/client';

@ApiTags('Departments')
@Controller('hospitals/:hospitalId/departments')
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PLATFORM_ADMIN, Role.HOSPITAL_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new department in a hospital (Admin only)' })
  async create(
    @Param('hospitalId') hospitalId: string,
    @Body() dto: CreateDepartmentDto,
    @GetUser() user: any,
  ) {
    this.checkScope(user, hospitalId);
    const result = await this.departmentsService.create(hospitalId, dto);
    return {
      success: true,
      message: 'Department created successfully',
      data: result,
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get departments for a specific hospital' })
  async findAll(@Param('hospitalId') hospitalId: string) {
    const result = await this.departmentsService.findByHospital(hospitalId);
    return { success: true, data: result };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get details of a specific department' })
  async findOne(
    @Param('hospitalId') hospitalId: string,
    @Param('id') id: string,
  ) {
    const result = await this.departmentsService.findOne(id, hospitalId);
    return { success: true, data: result };
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PLATFORM_ADMIN, Role.HOSPITAL_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update department details' })
  async update(
    @Param('hospitalId') hospitalId: string,
    @Param('id') id: string,
    @Body() dto: UpdateDepartmentDto,
    @GetUser() user: any,
  ) {
    this.checkScope(user, hospitalId);
    const result = await this.departmentsService.update(id, hospitalId, dto);
    return {
      success: true,
      message: 'Department details updated successfully',
      data: result,
    };
  }

  private checkScope(user: any, hospitalId: string) {
    if (user.role === Role.HOSPITAL_ADMIN && user.hospitalId !== hospitalId) {
      throw new ForbiddenException('You are not authorized to manage departments in this hospital');
    }
  }
}
