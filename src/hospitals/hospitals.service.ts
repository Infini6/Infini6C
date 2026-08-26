import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateHospitalDto, UpdateHospitalDto } from './dto/create-hospital.dto.js';
import { SetOperatingHoursDto } from './dto/operating-hours.dto.js';
import { CreateClosureDto } from './dto/closure.dto.js';
import { Hospital, HospitalStatus } from '@prisma/client';

@Injectable()
export class HospitalsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateHospitalDto): Promise<Hospital> {
    const existing = await this.prisma.hospital.findUnique({
      where: { code: dto.code },
    });
    if (existing) {
      throw new ConflictException(`Hospital with code ${dto.code} already exists`);
    }

    return this.prisma.hospital.create({
      data: {
        name: dto.name,
        code: dto.code,
        address: dto.address,
        contactNumber: dto.contactNumber,
        email: dto.email,
        timezone: dto.timezone || 'UTC',
        status: HospitalStatus.ACTIVE,
      },
    });
  }

  async update(id: string, dto: UpdateHospitalDto): Promise<Hospital> {
    await this.findOne(id);
    return this.prisma.hospital.update({
      where: { id },
      data: dto,
    });
  }

  async findAll(): Promise<Hospital[]> {
    return this.prisma.hospital.findMany({
      include: {
        operatingHours: true,
      },
    });
  }

  async findAllActive(): Promise<Hospital[]> {
    return this.prisma.hospital.findMany({
      where: { status: HospitalStatus.ACTIVE },
    });
  }

  async findOne(id: string) {
    const hospital = await this.prisma.hospital.findUnique({
      where: { id },
      include: {
        departments: {
          where: { status: 'ACTIVE' },
        },
        services: {
          where: { status: 'ACTIVE' },
        },
        operatingHours: true,
        closures: {
          where: { endDate: { gte: new Date() } },
        },
      },
    });

    if (!hospital) {
      throw new NotFoundException(`Hospital with ID ${id} not found`);
    }

    return hospital;
  }

  async setOperatingHours(hospitalId: string, dto: SetOperatingHoursDto) {
    await this.findOne(hospitalId);

    return this.prisma.hospitalOperatingHours.upsert({
      where: {
        hospitalId_dayOfWeek: {
          hospitalId,
          dayOfWeek: dto.dayOfWeek,
        },
      },
      update: {
        openTime: dto.openTime,
        closeTime: dto.closeTime,
      },
      create: {
        hospitalId,
        dayOfWeek: dto.dayOfWeek,
        openTime: dto.openTime,
        closeTime: dto.closeTime,
      },
    });
  }

  async addClosure(hospitalId: string, dto: CreateClosureDto) {
    await this.findOne(hospitalId);

    return this.prisma.hospitalClosure.create({
      data: {
        hospitalId,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        reason: dto.reason,
        type: dto.type,
      },
    });
  }
}
