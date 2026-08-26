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
import { ServicesService } from './services.service.js';
import { CreateServiceDto, UpdateServiceDto } from './dto/create-service.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/rbac.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { GetUser } from '../common/decorators/user.decorator.js';
import { Role } from '@prisma/client';

@ApiTags('Services')
@Controller('hospitals/:hospitalId/services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PLATFORM_ADMIN, Role.HOSPITAL_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new service in a hospital (Admin only)' })
  async create(
    @Param('hospitalId') hospitalId: string,
    @Body() dto: CreateServiceDto,
    @GetUser() user: any,
  ) {
    this.checkScope(user, hospitalId);
    const result = await this.servicesService.create(hospitalId, dto);
    return {
      success: true,
      message: 'Service created successfully',
      data: result,
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get services for a specific hospital' })
  async findAll(@Param('hospitalId') hospitalId: string) {
    const result = await this.servicesService.findByHospital(hospitalId);
    return { success: true, data: result };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get details of a specific service' })
  async findOne(
    @Param('hospitalId') hospitalId: string,
    @Param('id') id: string,
  ) {
    const result = await this.servicesService.findOne(id, hospitalId);
    return { success: true, data: result };
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PLATFORM_ADMIN, Role.HOSPITAL_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update service details' })
  async update(
    @Param('hospitalId') hospitalId: string,
    @Param('id') id: string,
    @Body() dto: UpdateServiceDto,
    @GetUser() user: any,
  ) {
    this.checkScope(user, hospitalId);
    const result = await this.servicesService.update(id, hospitalId, dto);
    return {
      success: true,
      message: 'Service details updated successfully',
      data: result,
    };
  }

  private checkScope(user: any, hospitalId: string) {
    if (user.role === Role.HOSPITAL_ADMIN && user.hospitalId !== hospitalId) {
      throw new ForbiddenException('You are not authorized to manage services in this hospital');
    }
  }
}
