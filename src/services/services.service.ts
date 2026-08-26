import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateServiceDto, UpdateServiceDto } from './dto/create-service.dto.js';
import { Service } from '@prisma/client';

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(hospitalId: string, dto: CreateServiceDto): Promise<Service> {
    const existing = await this.prisma.service.findUnique({
      where: {
        hospitalId_code: {
          hospitalId,
          code: dto.code,
        },
      },
    });
    if (existing) {
      throw new ConflictException(`Service with code ${dto.code} already exists in this hospital`);
    }

    return this.prisma.service.create({
      data: {
        hospitalId,
        name: dto.name,
        code: dto.code,
        description: dto.description || null,
        estimatedDurationMinutes: dto.estimatedDurationMinutes,
      },
    });
  }

  async update(id: string, hospitalId: string, dto: UpdateServiceDto): Promise<Service> {
    await this.findOne(id, hospitalId);
    return this.prisma.service.update({
      where: { id },
      data: dto,
    });
  }

  async findByHospital(hospitalId: string): Promise<Service[]> {
    return this.prisma.service.findMany({
      where: { hospitalId, status: 'ACTIVE' },
    });
  }

  async findOne(id: string, hospitalId: string): Promise<Service> {
    const service = await this.prisma.service.findFirst({
      where: { id, hospitalId },
    });
    if (!service) {
      throw new NotFoundException(`Service with ID ${id} not found in this hospital`);
    }
    return service;
  }
}
