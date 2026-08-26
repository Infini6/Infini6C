import { Controller, Get, Query, UseGuards, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuditingService } from './auditing.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/rbac.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { GetUser } from '../common/decorators/user.decorator.js';
import { Role } from '@prisma/client';

@ApiTags('Auditing')
@Controller('audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.PLATFORM_ADMIN, Role.HOSPITAL_ADMIN)
@ApiBearerAuth()
export class AuditingController {
  constructor(private readonly auditingService: AuditingService) {}

  @Get()
  @ApiOperation({ summary: 'View audit logs (Admins only)' })
  @ApiQuery({ name: 'hospitalId', required: false, type: String })
  @ApiQuery({ name: 'action', required: false, type: String })
  @ApiQuery({ name: 'actorUserId', required: false, type: String })
  async getLogs(
    @GetUser() user: any,
    @Query('hospitalId') hospitalId?: string,
    @Query('action') action?: string,
    @Query('actorUserId') actorUserId?: string,
  ) {
    if (user.role === Role.HOSPITAL_ADMIN) {
      if (hospitalId && hospitalId !== user.hospitalId) {
        throw new ForbiddenException('You can only query audit logs of your own hospital');
      }
      hospitalId = user.hospitalId;
    }

    const result = await this.auditingService.getLogs({
      hospitalId,
      action,
      actorUserId,
    });

    return { success: true, data: result };
  }
}
