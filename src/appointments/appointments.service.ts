import { Injectable, ConflictException, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { RedisService } from '../redis/redis.service.js';
import { CreateAppointmentDto } from './dto/create-appointment.dto.js';
import { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto.js';
import { Appointment, AppointmentStatus, Role } from '@prisma/client';

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async create(patientId: string, dto: CreateAppointmentDto): Promise<Appointment> {
    const patientProfile = await this.prisma.patient.findUnique({
      where: { id: patientId },
    });
    if (!patientProfile) {
      throw new NotFoundException('Patient profile not found');
    }
    const patientUserId = patientProfile.userId;

    const start = new Date(dto.appointmentDate);
    
    const service = await this.prisma.service.findFirst({
      where: { id: dto.serviceId, hospitalId: dto.hospitalId, status: 'ACTIVE' },
    });
    if (!service) {
      throw new NotFoundException('Selected service not found or inactive');
    }

    const duration = service.estimatedDurationMinutes;
    const end = new Date(start.getTime() + duration * 60 * 1000);

    const slotString = start.toISOString();
    const lockKey = `lock:doctor:${dto.doctorId}:slot:${slotString}`;
    
    const acquired = await this.redis.acquireLock(lockKey, 5000);
    if (!acquired) {
      throw new ConflictException(
        'This time slot is currently being processed by another booking. Please try again.'
      );
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        // A. Validate Hospital
        const hospital = await tx.hospital.findUnique({
          where: { id: dto.hospitalId },
          include: {
            operatingHours: { where: { dayOfWeek: start.getUTCDay() } },
            closures: {
              where: {
                startDate: { lte: end },
                endDate: { gte: start },
              },
            },
          },
        });

        if (!hospital || hospital.status !== 'ACTIVE') {
          throw new BadRequestException('Selected hospital is inactive or not found');
        }

        if (hospital.closures.length > 0) {
          throw new BadRequestException(
            `Hospital is closed on this day due to: ${hospital.closures[0].reason}`
          );
        }

        if (hospital.operatingHours.length === 0) {
          throw new BadRequestException('Hospital is closed on this day of the week');
        }
        
        const oph = hospital.operatingHours[0];
        const [openH, openM] = oph.openTime.split(':').map(Number);
        const [closeH, closeM] = oph.closeTime.split(':').map(Number);
        
        const openLimit = new Date(start);
        openLimit.setUTCHours(openH, openM, 0, 0);
        const closeLimit = new Date(start);
        closeLimit.setUTCHours(closeH, closeM, 0, 0);

        if (start < openLimit || end > closeLimit) {
          throw new BadRequestException(
            `Appointment time window must be within hospital operating hours (${oph.openTime} - ${oph.closeTime})`
          );
        }

        // B. Validate Department
        const department = await tx.department.findFirst({
          where: { id: dto.departmentId, hospitalId: dto.hospitalId, status: 'ACTIVE' },
        });
        if (!department) {
          throw new BadRequestException('Department is inactive or does not belong to this hospital');
        }

        // C. Validate Doctor
        const doctor = await tx.doctor.findFirst({
          where: { id: dto.doctorId, hospitalId: dto.hospitalId },
          include: {
            availability: { where: { dayOfWeek: start.getUTCDay() } },
            overrides: {
              where: {
                date: {
                  gte: new Date(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()),
                  lt: new Date(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + 1),
                },
              },
            },
          },
        });

        if (!doctor || doctor.status === 'SUSPENDED' || doctor.status === 'UNAVAILABLE') {
          throw new BadRequestException('Selected doctor is currently unavailable or not found');
        }

        // Check overrides
        if (doctor.overrides.length > 0) {
          const override = doctor.overrides[0];
          if (!override.isAvailable) {
            throw new BadRequestException(
              `Doctor ${doctor.fullName} is unavailable on this date: ${override.reason || 'No reason provided'}`
            );
          }
          if (override.startTime && override.endTime) {
            const [ovOpenH, ovOpenM] = override.startTime.split(':').map(Number);
            const [ovCloseH, ovCloseM] = override.endTime.split(':').map(Number);
            
            const ovOpenLimit = new Date(start);
            ovOpenLimit.setUTCHours(ovOpenH, ovOpenM, 0, 0);
            const ovCloseLimit = new Date(start);
            ovCloseLimit.setUTCHours(ovCloseH, ovCloseM, 0, 0);

            if (start < ovOpenLimit || end > ovCloseLimit) {
              throw new BadRequestException(
                `Selected time falls outside of the doctor's override schedule on this date (${override.startTime} - ${override.endTime})`
              );
            }
          }
        } else {
          if (doctor.availability.length === 0) {
            throw new BadRequestException(`Doctor ${doctor.fullName} is not scheduled to work on this day of the week`);
          }
          const da = doctor.availability[0];
          const [daOpenH, daOpenM] = da.startTime.split(':').map(Number);
          const [daCloseH, daCloseM] = da.endTime.split(':').map(Number);
          
          const daOpenLimit = new Date(start);
          daOpenLimit.setUTCHours(daOpenH, daOpenM, 0, 0);
          const daCloseLimit = new Date(start);
          daCloseLimit.setUTCHours(daCloseH, daCloseM, 0, 0);

          if (start < daOpenLimit || end > daCloseLimit) {
            throw new BadRequestException(
              `Selected time window falls outside of the doctor's schedule (${da.startTime} - ${da.endTime})`
            );
          }
        }

        // D. Overlap check
        const existingAppts = await tx.appointment.findMany({
          where: {
            doctorId: dto.doctorId,
            status: {
              in: [
                AppointmentStatus.REQUESTED,
                AppointmentStatus.PENDING_CONFIRMATION,
                AppointmentStatus.CONFIRMED,
                AppointmentStatus.CHECK_IN_PENDING,
                AppointmentStatus.CHECKED_IN,
                AppointmentStatus.IN_QUEUE,
                AppointmentStatus.IN_PROGRESS,
              ],
            },
            appointmentDate: {
              gte: new Date(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()),
              lt: new Date(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + 1),
            },
          },
        });

        const overlap = existingAppts.find((appt) => {
          const apptStart = new Date(appt.timeWindowStart);
          const apptEnd = new Date(appt.timeWindowEnd);
          return start < apptEnd && end > apptStart;
        });

        if (overlap) {
          throw new ConflictException(
            `Doctor ${doctor.fullName} already has a booking that overlaps with the requested time.`
          );
        }

        // E. Book slot
        const appointment = await tx.appointment.create({
          data: {
            patientId,
            hospitalId: dto.hospitalId,
            departmentId: dto.departmentId,
            doctorId: dto.doctorId,
            serviceId: dto.serviceId,
            appointmentDate: start,
            timeWindowStart: start,
            timeWindowEnd: end,
            status: AppointmentStatus.CONFIRMED,
          },
        });

        await tx.appointmentStatusHistory.create({
          data: {
            appointmentId: appointment.id,
            fromStatus: AppointmentStatus.REQUESTED,
            toStatus: AppointmentStatus.CONFIRMED,
            changedByUserId: patientUserId,
            reason: 'Initial booking auto-confirmation',
          },
        });

        return appointment;
      });
    } finally {
      await this.redis.releaseLock(lockKey);
    }
  }

  async cancel(id: string, actorUserId: string, actorRole: string): Promise<Appointment> {
    const appt = await this.prisma.appointment.findUnique({
      where: { id },
      include: { patient: true },
    });

    if (!appt) {
      throw new NotFoundException('Appointment not found');
    }

    if (actorRole === Role.PATIENT && appt.patient.userId !== actorUserId) {
      throw new ForbiddenException('You cannot cancel another patient\'s appointment');
    }

    if (appt.status === AppointmentStatus.COMPLETED || appt.status.startsWith('CANCELLED')) {
      throw new BadRequestException('Completed or already cancelled appointments cannot be cancelled');
    }

    let cancelStatus: AppointmentStatus = AppointmentStatus.CANCELLED_BY_PATIENT;
    if (actorRole === Role.DOCTOR) {
      cancelStatus = AppointmentStatus.CANCELLED_BY_DOCTOR;
    } else if (actorRole === Role.HOSPITAL_ADMIN || actorRole === Role.RECEPTIONIST) {
      cancelStatus = AppointmentStatus.CANCELLED_BY_HOSPITAL;
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.appointment.update({
        where: { id },
        data: { status: cancelStatus },
      });

      await tx.appointmentStatusHistory.create({
        data: {
          appointmentId: id,
          fromStatus: appt.status,
          toStatus: cancelStatus,
          changedByUserId: actorUserId,
          reason: 'Cancelled by user request',
        },
      });

      return updated;
    });
  }

  async reschedule(id: string, dto: RescheduleAppointmentDto, actorUserId: string, actorRole: string): Promise<Appointment> {
    const appt = await this.prisma.appointment.findUnique({
      where: { id },
      include: { patient: true },
    });

    if (!appt) {
      throw new NotFoundException('Appointment not found');
    }

    if (actorRole === Role.PATIENT && appt.patient.userId !== actorUserId) {
      throw new ForbiddenException('You cannot reschedule another patient\'s appointment');
    }

    if (appt.status === AppointmentStatus.COMPLETED || appt.status.startsWith('CANCELLED')) {
      throw new BadRequestException('Completed or cancelled appointments cannot be rescheduled');
    }

    const start = new Date(dto.newAppointmentDate);
    const service = await this.prisma.service.findUnique({ where: { id: appt.serviceId } });
    const duration = service?.estimatedDurationMinutes || 15;
    const end = new Date(start.getTime() + duration * 60 * 1000);

    const slotString = start.toISOString();
    const lockKey = `lock:doctor:${appt.doctorId}:slot:${slotString}`;
    
    const acquired = await this.redis.acquireLock(lockKey, 5000);
    if (!acquired) {
      throw new ConflictException('This time slot is currently being processed by another booking. Please try again.');
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existingAppts = await tx.appointment.findMany({
          where: {
            id: { not: id },
            doctorId: appt.doctorId,
            status: {
              in: [
                AppointmentStatus.REQUESTED,
                AppointmentStatus.PENDING_CONFIRMATION,
                AppointmentStatus.CONFIRMED,
                AppointmentStatus.CHECK_IN_PENDING,
                AppointmentStatus.CHECKED_IN,
                AppointmentStatus.IN_QUEUE,
                AppointmentStatus.IN_PROGRESS,
              ],
            },
            appointmentDate: {
              gte: new Date(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()),
              lt: new Date(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + 1),
            },
          },
        });

        const overlap = existingAppts.find((a) => {
          const apptStart = new Date(a.timeWindowStart);
          const apptEnd = new Date(a.timeWindowEnd);
          return start < apptEnd && end > apptStart;
        });

        if (overlap) {
          throw new ConflictException('The selected slot overlaps with an existing booking.');
        }

        const updated = await tx.appointment.update({
          where: { id },
          data: {
            appointmentDate: start,
            timeWindowStart: start,
            timeWindowEnd: end,
            status: AppointmentStatus.RESCHEDULED,
          },
        });

        await tx.appointmentStatusHistory.create({
          data: {
            appointmentId: id,
            fromStatus: appt.status,
            toStatus: AppointmentStatus.RESCHEDULED,
            changedByUserId: actorUserId,
            reason: 'Rescheduled by user request',
          },
        });

        return updated;
      });
    } finally {
      await this.redis.releaseLock(lockKey);
    }
  }

  async findAll(params: {
    patientId?: string;
    hospitalId?: string;
    doctorId?: string;
    date?: string;
  }): Promise<Appointment[]> {
    const whereClause: any = {};

    if (params.patientId) whereClause.patientId = params.patientId;
    if (params.hospitalId) whereClause.hospitalId = params.hospitalId;
    if (params.doctorId) whereClause.doctorId = params.doctorId;
    
    if (params.date) {
      const day = new Date(params.date);
      whereClause.appointmentDate = {
        gte: new Date(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()),
        lt: new Date(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate() + 1),
      };
    }

    return this.prisma.appointment.findMany({
      where: whereClause,
      include: {
        patient: true,
        doctor: true,
        service: true,
        department: true,
      },
      orderBy: { appointmentDate: 'asc' },
    });
  }

  async findOne(id: string): Promise<Appointment> {
    const appt = await this.prisma.appointment.findUnique({
      where: { id },
      include: {
        patient: true,
        doctor: true,
        service: true,
        department: true,
        payment: true,
        history: true,
      },
    });

    if (!appt) {
      throw new NotFoundException(`Appointment with ID ${id} not found`);
    }

    return appt;
  }
}
