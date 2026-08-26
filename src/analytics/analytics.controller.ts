import { Controller, Get, Query, UseGuards, ForbiddenException, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/rbac.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { GetUser } from '../common/decorators/user.decorator.js';
import { Role } from '@prisma/client';

@ApiTags('Analytics')
@Controller('hospitals/:hospitalId/analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.PLATFORM_ADMIN, Role.HOSPITAL_ADMIN)
@ApiBearerAuth()
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get hospital analytics dashboard metrics' })
  @ApiQuery({ name: 'date', required: false, type: String, description: 'YYYY-MM-DD' })
  async getDashboard(
    @Param('hospitalId') hospitalId: string,
    @GetUser() user: any,
    @Query('date') date?: string,
  ) {
    if (user.role === Role.HOSPITAL_ADMIN && user.hospitalId !== hospitalId) {
      throw new ForbiddenException('You are not authorized to view analytics for this hospital');
    }

    const result = await this.analyticsService.getDashboardMetrics(hospitalId, date);
    return { success: true, data: result };
  }
}
