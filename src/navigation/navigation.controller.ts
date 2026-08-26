import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { NavigationService } from './navigation.service.js';
import { CreateRouteDto } from './dto/create-route.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/rbac.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { GetUser } from '../common/decorators/user.decorator.js';
import { Role } from '@prisma/client';

@ApiTags('Navigation')
@Controller('hospitals/:hospitalId/navigation')
export class NavigationController {
  constructor(private readonly navigationService: NavigationService) {}

  @Get()
  @ApiOperation({ summary: 'Get indoor navigation steps from starting location to destination' })
  @ApiQuery({ name: 'startPoint', required: true, type: String })
  @ApiQuery({ name: 'endPoint', required: true, type: String })
  async getRoute(
    @Param('hospitalId') hospitalId: string,
    @Query('startPoint') startPoint: string,
    @Query('endPoint') endPoint: string,
  ) {
    const result = await this.navigationService.getRoute(hospitalId, startPoint, endPoint);
    return { success: true, data: result };
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PLATFORM_ADMIN, Role.HOSPITAL_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Register a new indoor navigation route (Admin only)' })
  async createRoute(
    @Param('hospitalId') hospitalId: string,
    @Body() dto: CreateRouteDto,
    @GetUser() user: any,
  ) {
    if (user.role === Role.HOSPITAL_ADMIN && user.hospitalId !== hospitalId) {
      throw new ForbiddenException('You are not authorized to manage navigation for this hospital');
    }

    const result = await this.navigationService.createRoute(
      hospitalId,
      dto.name,
      `Route from ${dto.startPoint} to ${dto.endPoint}`,
      dto.steps,
    );

    return {
      success: true,
      message: 'Navigation route registered successfully',
      data: result,
    };
  }
}
