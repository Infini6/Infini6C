import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateStaffDto, UpdateStaffDto } from './dto/create-staff.dto.js';
import { Role, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';

@Injectable()
export class StaffService {
  constructor(private readonly prisma: PrismaService) {}

  async create(hospitalId: string, dto: CreateStaffDto) {
    const existingEmail = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existingEmail) {
      throw new ConflictException('Email already registered');
    }
    if (dto.phone) {
      const existingPhone = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
      if (existingPhone) {
        throw new ConflictException('Phone number already registered');
      }
    }

    const passwordHash = await argon2.hash(dto.password);

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: dto.email,
          phone: dto.phone || null,
          passwordHash,
          role: dto.role,
          status: UserStatus.ACTIVE,
        },
      });

      if (dto.role === Role.HOSPITAL_ADMIN) {
        const admin = await tx.hospitalAdmin.create({
          data: {
            userId: user.id,
            hospitalId,
            fullName: dto.fullName,
          },
        });
        return { user, profile: admin };
      } else {
        const staff = await tx.hospitalStaff.create({
          data: {
            userId: user.id,
            hospitalId,
            fullName: dto.fullName,
          },
        });
        return { user, profile: staff };
      }
    });
  }

  async update(id: string, hospitalId: string, dto: UpdateStaffDto) {
    const staff = await this.findOne(id, hospitalId);

    return this.prisma.$transaction(async (tx) => {
      let updatedProfile: any;

      if (staff.user.role === Role.HOSPITAL_ADMIN) {
        updatedProfile = await tx.hospitalAdmin.update({
          where: { id },
          data: {
            fullName: dto.fullName,
          },
        });
      } else {
        updatedProfile = await tx.hospitalStaff.update({
          where: { id },
          data: {
            fullName: dto.fullName,
          },
        });
      }

      if (dto.role) {
        await tx.user.update({
          where: { id: staff.userId },
          data: { role: dto.role },
        });
      }

      return updatedProfile;
    });
  }

  async findByHospital(hospitalId: string) {
    const staffList = await this.prisma.hospitalStaff.findMany({
      where: { hospitalId },
      include: {
        user: true,
      },
    });

    const adminsList = await this.prisma.hospitalAdmin.findMany({
      where: { hospitalId },
      include: {
        user: true,
      },
    });

    return {
      staff: staffList,
      admins: adminsList,
    };
  }

  async findOne(id: string, hospitalId: string) {
    let staff: any = await this.prisma.hospitalStaff.findFirst({
      where: { id, hospitalId },
      include: { user: true },
    });

    if (!staff) {
      staff = await this.prisma.hospitalAdmin.findFirst({
        where: { id, hospitalId },
        include: { user: true },
      });
    }

    if (!staff) {
      throw new NotFoundException(`Staff with ID ${id} not found in this hospital`);
    }

    return staff;
  }
}
