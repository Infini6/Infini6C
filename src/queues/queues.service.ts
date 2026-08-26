import { Injectable, ConflictException, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { RedisService } from '../redis/redis.service.js';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CheckInDto } from './dto/check-in.dto.js';
import {
  Queue,
  QueueEntry,
  QueueStatus,
  QueueEntryStatus,
  QueueEventType,
  AppointmentStatus,
  DoctorStatus,
  Role,
} from '@prisma/client';

@Injectable()
export class QueuesService {
  private readonly logger = new Logger(QueuesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async checkIn(appointmentId: string, actorUserId: string, actorRole: string) {
    const appt = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { patient: true, service: true },
    });

    if (!appt) {
      throw new NotFoundException('Appointment not found');
    }

    if (actorRole === Role.PATIENT && appt.patient.userId !== actorUserId) {
      throw new ForbiddenException('You cannot check-in for another patient\'s appointment');
    }

    if (appt.status === AppointmentStatus.CHECKED_IN || appt.status === AppointmentStatus.IN_QUEUE) {
      throw new BadRequestException('Appointment is already checked-in');
    }

    if (appt.status !== AppointmentStatus.CONFIRMED && appt.status !== AppointmentStatus.RESCHEDULED) {
      throw new BadRequestException(`Cannot check-in. Appointment status is: ${appt.status}`);
    }

    // Verify date is today
    const now = new Date();
    const apptDate = new Date(appt.appointmentDate);
    if (
      apptDate.getUTCFullYear() !== now.getUTCFullYear() ||
      apptDate.getUTCMonth() !== now.getUTCMonth() ||
      apptDate.getUTCDate() !== now.getUTCDate()
    ) {
      throw new BadRequestException('Check-in is only allowed on the day of the appointment');
    }

    // Check-in & Queue Entry Insertion transaction
    const txResult = await this.prisma.$transaction(async (tx) => {
      const updatedAppt = await tx.appointment.update({
        where: { id: appointmentId },
        data: { status: AppointmentStatus.CHECKED_IN },
      });

      await tx.appointmentStatusHistory.create({
        data: {
          appointmentId,
          fromStatus: appt.status,
          toStatus: AppointmentStatus.CHECKED_IN,
          changedByUserId: actorUserId,
          reason: 'Patient self-check-in / scanned QR code',
        },
      });

      const startOfDay = new Date(now);
      startOfDay.setUTCHours(0, 0, 0, 0);

      let queue = await tx.queue.findFirst({
        where: {
          doctorId: appt.doctorId,
          date: startOfDay,
        },
      });

      if (!queue) {
        queue = await tx.queue.create({
          data: {
            hospitalId: appt.hospitalId,
            departmentId: appt.departmentId,
            doctorId: appt.doctorId,
            date: startOfDay,
            status: QueueStatus.ACTIVE,
          },
        });
      }

      if (queue.status === QueueStatus.CLOSED) {
        throw new BadRequestException('The doctor queue for today is closed.');
      }

      const queueEntry = await tx.queueEntry.create({
        data: {
          queueId: queue.id,
          appointmentId: appt.id,
          patientId: appt.patientId,
          serviceId: appt.serviceId,
          estimatedDurationMinutes: appt.service.estimatedDurationMinutes,
          position: 9999,
          estimatedStartTime: now,
          estimatedEndTime: now,
          recommendedArrivalTime: now,
          status: QueueEntryStatus.WAITING,
        },
      });

      await tx.queueEvent.create({
        data: {
          queueEntryId: queueEntry.id,
          type: QueueEventType.PATIENT_CHECKED_IN,
          triggeredByUserId: actorUserId,
        },
      });

      await this.recalculateQueueInternal(queue.id, tx);

      return {
        appointment: updatedAppt,
        queueEntry,
      };
    });

    this.eventEmitter.emit('patient.checked_in', { appointmentId, actorUserId });
    return txResult;
  }

  async callNext(hospitalId: string, queueId: string, actorUserId: string) {
    const queue = await this.prisma.queue.findFirst({
      where: { id: queueId, hospitalId },
    });
    if (!queue) {
      throw new NotFoundException('Queue not found in this hospital');
    }

    return this.prisma.$transaction(async (tx) => {
      // Find the next WAITING entry by position
      const nextEntry = await tx.queueEntry.findFirst({
        where: {
          queueId,
          status: QueueEntryStatus.WAITING,
        },
        orderBy: { position: 'asc' },
      });

      if (!nextEntry) {
        throw new BadRequestException('No patients waiting in queue.');
      }

      // Update status to CALLED
      const updatedEntry = await tx.queueEntry.update({
        where: { id: nextEntry.id },
        data: { status: QueueEntryStatus.CALLED },
      });

      await tx.queueEvent.create({
        data: {
          queueEntryId: nextEntry.id,
          type: QueueEventType.PATIENT_CALLED,
          triggeredByUserId: actorUserId,
        },
      });

      await this.recalculateQueueInternal(queueId, tx);

      // Emit event internally
      this.eventEmitter.emit('queue.patient_called', {
        patientId: nextEntry.patientId,
        queueEntryId: nextEntry.id,
        doctorId: queue.doctorId,
        queueId,
      });

      return updatedEntry;
    });
  }

  async skip(hospitalId: string, entryId: string, actorUserId: string) {
    const entry = await this.prisma.queueEntry.findFirst({
      where: { id: entryId, queue: { hospitalId } },
    });
    if (!entry) {
      throw new NotFoundException('Queue entry not found in this hospital');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.queueEntry.update({
        where: { id: entryId },
        data: { status: QueueEntryStatus.SKIPPED },
      });

      await tx.queueEvent.create({
        data: {
          queueEntryId: entryId,
          type: QueueEventType.PATIENT_SKIPPED,
          triggeredByUserId: actorUserId,
        },
      });

      await this.recalculateQueueInternal(entry.queueId, tx);
      return updated;
    });
  }

  async startConsultation(hospitalId: string, entryId: string, actorUserId: string) {
    const entry = await this.prisma.queueEntry.findFirst({
      where: { id: entryId, queue: { hospitalId } },
      include: { queue: true },
    });
    if (!entry) {
      throw new NotFoundException('Queue entry not found in this hospital');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Update entry to IN_PROGRESS
      const updated = await tx.queueEntry.update({
        where: { id: entryId },
        data: { status: QueueEntryStatus.IN_PROGRESS },
      });

      // 2. Update Doctor status to BUSY
      await tx.doctor.update({
        where: { id: entry.queue.doctorId },
        data: { status: DoctorStatus.BUSY },
      });

      // 3. Update Appointment status to IN_PROGRESS
      await tx.appointment.update({
        where: { id: entry.appointmentId },
        data: { status: AppointmentStatus.IN_PROGRESS },
      });

      await tx.queueEvent.create({
        data: {
          queueEntryId: entryId,
          type: QueueEventType.PATIENT_STARTED,
          triggeredByUserId: actorUserId,
        },
      });

      await this.recalculateQueueInternal(entry.queueId, tx);
      return updated;
    });
  }

  async completeConsultation(hospitalId: string, entryId: string, actorUserId: string) {
    const entry = await this.prisma.queueEntry.findFirst({
      where: { id: entryId, queue: { hospitalId } },
      include: { queue: true },
    });
    if (!entry) {
      throw new NotFoundException('Queue entry not found in this hospital');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Update entry to COMPLETED
      const updated = await tx.queueEntry.update({
        where: { id: entryId },
        data: { status: QueueEntryStatus.COMPLETED },
      });

      // 2. Update Doctor status back to AVAILABLE
      await tx.doctor.update({
        where: { id: entry.queue.doctorId },
        data: { status: DoctorStatus.AVAILABLE },
      });

      // 3. Update Appointment status to COMPLETED
      await tx.appointment.update({
        where: { id: entry.appointmentId },
        data: { status: AppointmentStatus.COMPLETED },
      });

      await tx.queueEvent.create({
        data: {
          queueEntryId: entryId,
          type: QueueEventType.PATIENT_COMPLETED,
          triggeredByUserId: actorUserId,
        },
      });

      await this.recalculateQueueInternal(entry.queueId, tx);

      // 4. Calculate actual duration and cache in Redis
      const actualDuration = Math.round(
        (new Date().getTime() - new Date(entry.createdAt).getTime()) / (60 * 1000)
      );
      this.logger.log(`Completed consultation in ${actualDuration} minutes`);
      
      return updated;
    });
  }

  async setPriority(hospitalId: string, entryId: string, priority: number, actorUserId: string) {
    const entry = await this.prisma.queueEntry.findFirst({
      where: { id: entryId, queue: { hospitalId } },
    });
    if (!entry) {
      throw new NotFoundException('Queue entry not found in this hospital');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.queueEntry.update({
        where: { id: entryId },
        data: { priority },
      });

      await tx.queueEvent.create({
        data: {
          queueEntryId: entryId,
          type: QueueEventType.QUEUE_REORDERED,
          payload: { newPriority: priority },
          triggeredByUserId: actorUserId,
        },
      });

      await this.recalculateQueueInternal(entry.queueId, tx);
      return updated;
    });
  }

  // Recalculates waiting times and queue ordering
  async recalculateQueue(queueId: string) {
    await this.prisma.$transaction(async (tx) => {
      await this.recalculateQueueInternal(queueId, tx);
    });
  }

  private async recalculateQueueInternal(queueId: string, tx: any) {
    const now = new Date();

    // 1. Fetch all active entries in this queue
    const entries = await tx.queueEntry.findMany({
      where: {
        queueId,
        status: {
          in: [
            QueueEntryStatus.WAITING,
            QueueEntryStatus.CALLED,
            QueueEntryStatus.IN_PROGRESS,
            QueueEntryStatus.SKIPPED,
          ],
        },
      },
      include: {
        appointment: true,
      },
    });

    if (entries.length === 0) return;

    // 2. Separate serving/active entries and waiting entries
    const activeEntries = entries.filter(
      (e: any) => e.status === QueueEntryStatus.IN_PROGRESS || e.status === QueueEntryStatus.CALLED
    );

    const waitingEntries = entries.filter(
      (e: any) => e.status === QueueEntryStatus.WAITING || e.status === QueueEntryStatus.SKIPPED
    );

    // 3. Compute active end time baseline
    let activeEndTime = new Date(now);
    if (activeEntries.length > 0) {
      // Find the entry that has the largest end time or standard duration
      const currentActive = activeEntries[0];
      const activeDuration = currentActive.estimatedDurationMinutes;
      const expectedEnd = new Date(new Date(currentActive.updatedAt).getTime() + activeDuration * 60 * 1000);
      activeEndTime = expectedEnd > now ? expectedEnd : new Date(now.getTime() + 5 * 60 * 1000); // at least 5 mins remaining
    }

    // 4. Recalculate effective priority for WAITING/SKIPPED (anti-starvation)
    const waitingWithPriority = waitingEntries.map((e: any) => {
      const waitTimeMinutes = Math.max(0, (now.getTime() - new Date(e.createdAt).getTime()) / (60 * 1000));
      const agingFactor = waitTimeMinutes / 15;
      const effectivePriority = e.priority + agingFactor;

      return {
        entry: e,
        effectivePriority,
      };
    });

    // 5. Sort waiting entries: effectivePriority desc, appointmentDate asc, createdAt asc
    waitingWithPriority.sort((a: any, b: any) => {
      if (b.effectivePriority !== a.effectivePriority) {
        return b.effectivePriority - a.effectivePriority;
      }
      const dateA = new Date(a.entry.appointment.appointmentDate).getTime();
      const dateB = new Date(b.entry.appointment.appointmentDate).getTime();
      if (dateA !== dateB) {
        return dateA - dateB;
      }
      return new Date(a.entry.createdAt).getTime() - new Date(b.entry.createdAt).getTime();
    });

    // 6. Update positions and estimated start/end times in DB
    let currentStartTime = new Date(activeEndTime);

    for (let i = 0; i < waitingWithPriority.length; i++) {
      const item = waitingWithPriority[i];
      const entry = item.entry;
      const position = i + 1;

      const estimatedStartTime = new Date(currentStartTime);
      const estimatedEndTime = new Date(
        estimatedStartTime.getTime() + entry.estimatedDurationMinutes * 60 * 1000
      );

      // Recommended arrival = 15 minutes before estimated start
      const recommendedArrivalTime = new Date(
        estimatedStartTime.getTime() - 15 * 60 * 1000
      );

      await tx.queueEntry.update({
        where: { id: entry.id },
        data: {
          position,
          estimatedStartTime,
          estimatedEndTime,
          recommendedArrivalTime,
        },
      });

      // advance baseline for next entry
      currentStartTime = estimatedEndTime;
    }

    // Emit event internally
    this.eventEmitter.emit('queue.updated', {
      queueId,
      timestamp: now,
    });
  }

  async getQueueState(hospitalId: string, queueId: string) {
    const queue = await this.prisma.queue.findFirst({
      where: { id: queueId, hospitalId },
      include: {
        entries: {
          include: {
            patient: true,
            appointment: true,
            service: true,
          },
          orderBy: { position: 'asc' },
        },
        doctor: true,
      },
    });

    if (!queue) {
      throw new NotFoundException('Queue not found in this hospital');
    }

    return queue;
  }
}
