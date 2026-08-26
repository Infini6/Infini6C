import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditLog, Role } from '@prisma/client';

@Injectable()
export class AuditingService {
  constructor(private readonly prisma: PrismaService) {}

  async log(params: {
    actorUserId?: string;
    actorRole?: Role;
    hospitalId?: string;
    action: string;
    resourceType: string;
    resourceIdentifier: string;
    status: string;
    metadata?: any;
  }): Promise<AuditLog> {
    return this.prisma.auditLog.create({
      data: {
        actorUserId: params.actorUserId || null,
        actorRole: params.actorRole || null,
        hospitalId: params.hospitalId || null,
        action: params.action,
        resourceType: params.resourceType,
        resourceIdentifier: params.resourceIdentifier,
        status: params.status,
        metadata: params.metadata || null,
      },
    });
  }

  async getLogs(params: {
    hospitalId?: string;
    action?: string;
    actorUserId?: string;
  }): Promise<AuditLog[]> {
    const where: any = {};
    if (params.hospitalId) where.hospitalId = params.hospitalId;
    if (params.action) where.action = params.action;
    if (params.actorUserId) where.actorUserId = params.actorUserId;

    return this.prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: 200,
    });
  }
}
