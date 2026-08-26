import { Controller, Get, UseGuards, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/rbac.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { GetUser } from '../common/decorators/user.decorator.js';
import { Role } from '@prisma/client';

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @Roles(Role.PATIENT)
  @ApiOperation({ summary: 'Get recent notifications for the logged-in patient' })
  async getNotifications(@GetUser() user: any) {
    if (!user.patientId) {
      throw new ForbiddenException('Patient profile is not registered');
    }
    const result = await this.notificationsService.getNotificationsForPatient(user.patientId);
    return { success: true, data: result };
  }
}
