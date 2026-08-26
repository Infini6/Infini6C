import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateDepartmentDto, UpdateDepartmentDto } from './dto/create-department.dto.js';
import { Department } from '@prisma/client';

@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(hospitalId: string, dto: CreateDepartmentDto): Promise<Department> {
    const existing = await this.prisma.department.findUnique({
      where: {
        hospitalId_code: {
          hospitalId,
          code: dto.code,
        },
      },
    });
    if (existing) {
      throw new ConflictException(`Department with code ${dto.code} already exists in this hospital`);
    }

    return this.prisma.department.create({
      data: {
        hospitalId,
        name: dto.name,
        code: dto.code,
        description: dto.description || null,
        location: dto.location || null,
      },
    });
  }

  async update(id: string, hospitalId: string, dto: UpdateDepartmentDto): Promise<Department> {
    await this.findOne(id, hospitalId);
    return this.prisma.department.update({
      where: { id },
      data: dto,
    });
  }

  async findByHospital(hospitalId: string): Promise<Department[]> {
    return this.prisma.department.findMany({
      where: { hospitalId, status: 'ACTIVE' },
    });
  }

  async findOne(id: string, hospitalId: string): Promise<Department> {
    const dept = await this.prisma.department.findFirst({
      where: { id, hospitalId },
    });
    if (!dept) {
      throw new NotFoundException(`Department with ID ${id} not found in this hospital`);
    }
    return dept;
  }
}
