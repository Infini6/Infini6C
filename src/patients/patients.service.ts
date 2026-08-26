import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Patient } from '@prisma/client';

@Injectable()
export class PatientsService {
  constructor(private readonly prisma: PrismaService) {}

  async findByUserId(userId: string): Promise<Patient | null> {
    return this.prisma.patient.findUnique({
      where: { userId },
    });
  }

  async findById(id: string): Promise<Patient | null> {
    return this.prisma.patient.findUnique({
      where: { id },
    });
  }

  async createPatient(data: {
    userId: string;
    fullName: string;
    dateOfBirth: Date;
    gender: string;
    address?: string;
  }): Promise<Patient> {
    return this.prisma.patient.create({
      data,
    });
  }

  async updatePatient(
    id: string,
    data: {
      fullName?: string;
      dateOfBirth?: Date;
      gender?: string;
      address?: string;
    },
  ): Promise<Patient> {
    return this.prisma.patient.update({
      where: { id },
      data,
    });
  }
}
