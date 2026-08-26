import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateDoctorDto, UpdateDoctorDto } from './dto/create-doctor.dto.js';
import { DoctorAvailabilityDto } from './dto/availability.dto.js';
import { DoctorOverrideDto } from './dto/override.dto.js';
import { Doctor, Role, UserStatus, DoctorStatus, AppointmentStatus } from '@prisma/client';
import * as argon2 from 'argon2';

@Injectable()
export class DoctorsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(hospitalId: string, dto: CreateDoctorDto) {
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
          role: Role.DOCTOR,
          status: UserStatus.ACTIVE,
        },
      });

      const doctor = await tx.doctor.create({
        data: {
          userId: user.id,
          hospitalId,
          fullName: dto.fullName,
          specialization: dto.specialization,
          status: DoctorStatus.AVAILABLE,
        },
      });

      if (dto.departmentIds && dto.departmentIds.length > 0) {
        await tx.doctorDepartment.createMany({
          data: dto.departmentIds.map((departmentId) => ({
            doctorId: doctor.id,
            departmentId,
          })),
        });
      }

      return this.findOne(doctor.id, hospitalId);
    });
  }

  async update(id: string, hospitalId: string, dto: UpdateDoctorDto): Promise<Doctor> {
    await this.findOne(id, hospitalId);
    return this.prisma.doctor.update({
      where: { id },
      data: dto,
    });
  }

  async findByHospital(hospitalId: string, departmentId?: string) {
    const whereClause: any = { hospitalId };

    if (departmentId) {
      whereClause.departments = {
        some: { departmentId },
      };
    }

    return this.prisma.doctor.findMany({
      where: whereClause,
      include: {
        departments: {
          include: { department: true },
        },
        availability: true,
        overrides: true,
      },
    });
  }

  async findOne(id: string, hospitalId: string) {
    const doctor = await this.prisma.doctor.findFirst({
      where: { id, hospitalId },
      include: {
        departments: {
          include: { department: true },
        },
        availability: true,
        overrides: true,
      },
    });

    if (!doctor) {
      throw new NotFoundException(`Doctor with ID ${id} not found in this hospital`);
    }

    return doctor;
  }

  async setAvailability(id: string, hospitalId: string, dto: DoctorAvailabilityDto) {
    await this.findOne(id, hospitalId);

    return this.prisma.doctorAvailability.upsert({
      where: {
        doctorId_dayOfWeek: {
          doctorId: id,
          dayOfWeek: dto.dayOfWeek,
        },
      },
      update: {
        startTime: dto.startTime,
        endTime: dto.endTime,
      },
      create: {
        doctorId: id,
        dayOfWeek: dto.dayOfWeek,
        startTime: dto.startTime,
        endTime: dto.endTime,
      },
    });
  }

  async addOverride(id: string, hospitalId: string, dto: DoctorOverrideDto) {
    await this.findOne(id, hospitalId);

    const date = new Date(dto.date);
    date.setUTCHours(0, 0, 0, 0);

    await this.prisma.doctorOverride.deleteMany({
      where: {
        doctorId: id,
        date,
      },
    });

    return this.prisma.doctorOverride.create({
      data: {
        doctorId: id,
        date,
        startTime: dto.startTime || null,
        endTime: dto.endTime || null,
        isAvailable: dto.isAvailable,
        reason: dto.reason || null,
      },
    });
  }

  async declareUnavailability(hospitalId: string, doctorId: string, dto: DoctorOverrideDto, actorUserId: string) {
    const doctor = await this.findOne(doctorId, hospitalId);
    
    const date = new Date(dto.date);
    date.setUTCHours(0, 0, 0, 0);

    await this.prisma.$transaction(async (tx) => {
      await tx.doctorOverride.deleteMany({
        where: { doctorId, date },
      });
      await tx.doctorOverride.create({
        data: {
          doctorId,
          date,
          startTime: dto.startTime || null,
          endTime: dto.endTime || null,
          isAvailable: false,
          reason: dto.reason || 'Doctor declared unavailable',
        },
      });

      const startOfDay = new Date(date);
      startOfDay.setUTCHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setUTCHours(23, 59, 59, 999);

      const affectedAppts = await tx.appointment.findMany({
        where: {
          doctorId,
          status: {
            in: [
              AppointmentStatus.REQUESTED,
              AppointmentStatus.PENDING_CONFIRMATION,
              AppointmentStatus.CONFIRMED,
              AppointmentStatus.RESCHEDULED,
            ],
          },
          appointmentDate: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
        include: {
          patient: true,
          service: true,
        },
      });

      for (const appt of affectedAppts) {
        const start = new Date(appt.timeWindowStart);
        const end = new Date(appt.timeWindowEnd);

        const substitutes = await tx.doctor.findMany({
          where: {
            id: { not: doctorId },
            hospitalId,
            specialization: doctor.specialization,
            status: DoctorStatus.AVAILABLE,
            departments: {
              some: { departmentId: appt.departmentId },
            },
          },
          include: {
            availability: { where: { dayOfWeek: start.getUTCDay() } },
            overrides: {
              where: {
                date: {
                  gte: startOfDay,
                  lte: endOfDay,
                },
              },
            },
            appointments: {
              where: {
                status: {
                  in: [
                    AppointmentStatus.REQUESTED,
                    AppointmentStatus.PENDING_CONFIRMATION,
                    AppointmentStatus.CONFIRMED,
                    AppointmentStatus.RESCHEDULED,
                  ],
                },
                appointmentDate: {
                  gte: startOfDay,
                  lte: endOfDay,
                },
              },
            },
          },
        });

        let foundSubstitute = false;
        for (const sub of substitutes) {
          let isSubAvailable = false;
          if (sub.overrides.length > 0) {
            const ov = sub.overrides[0];
            if (ov.isAvailable) {
              if (ov.startTime && ov.endTime) {
                const [ovOpenH, ovOpenM] = ov.startTime.split(':').map(Number);
                const [ovCloseH, ovCloseM] = ov.endTime.split(':').map(Number);
                const ovOpenLimit = new Date(start);
                ovOpenLimit.setUTCHours(ovOpenH, ovOpenM, 0, 0);
                const ovCloseLimit = new Date(start);
                ovCloseLimit.setUTCHours(ovCloseH, ovCloseM, 0, 0);
                isSubAvailable = start >= ovOpenLimit && end <= ovCloseLimit;
              } else {
                isSubAvailable = true;
              }
            }
          } else if (sub.availability.length > 0) {
            const da = sub.availability[0];
            const [daOpenH, daOpenM] = da.startTime.split(':').map(Number);
            const [daCloseH, daCloseM] = da.endTime.split(':').map(Number);
            const daOpenLimit = new Date(start);
            daOpenLimit.setUTCHours(daOpenH, daOpenM, 0, 0);
            const daCloseLimit = new Date(start);
            daCloseLimit.setUTCHours(daCloseH, daCloseM, 0, 0);
            isSubAvailable = start >= daOpenLimit && end <= daCloseLimit;
          }

          if (isSubAvailable) {
            const hasOverlap = sub.appointments.some((a: any) => {
              const aStart = new Date(a.timeWindowStart);
              const aEnd = new Date(a.timeWindowEnd);
              return start < aEnd && end > aStart;
            });

            if (!hasOverlap) {
              await tx.appointment.update({
                where: { id: appt.id },
                data: {
                  doctorId: sub.id,
                  status: AppointmentStatus.RESCHEDULED,
                },
              });

              await tx.appointmentStatusHistory.create({
                data: {
                  appointmentId: appt.id,
                  fromStatus: appt.status,
                  toStatus: AppointmentStatus.RESCHEDULED,
                  changedByUserId: actorUserId,
                  reason: `Reassigned to replacement doctor ${sub.fullName} due to original doctor absence`,
                },
              });

              foundSubstitute = true;
              break;
            }
          }
        }

        if (!foundSubstitute) {
          await tx.appointment.update({
            where: { id: appt.id },
            data: {
              status: AppointmentStatus.PENDING_CONFIRMATION,
            },
          });

          await tx.appointmentStatusHistory.create({
            data: {
              appointmentId: appt.id,
              fromStatus: appt.status,
              toStatus: AppointmentStatus.PENDING_CONFIRMATION,
              changedByUserId: actorUserId,
              reason: 'Doctor unavailable, reassignment failed. Awaiting rescheduling options.',
            },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          actorUserId,
          action: 'DECLARE_UNAVAILABILITY',
          resourceType: 'DOCTOR',
          resourceIdentifier: doctorId,
          status: 'SUCCESS',
          hospitalId,
          metadata: {
            date: date.toISOString(),
            reason: dto.reason || 'None',
            affectedCount: affectedAppts.length,
          },
        },
      });
    });

    return {
      success: true,
      message: 'Unavailability declared and affected appointments processed successfully',
    };
  }
}
