import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { QueueEntryStatus } from '@prisma/client';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardMetrics(hospitalId: string, dateStr?: string) {
    const targetDate = dateStr ? new Date(dateStr) : new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const totalAppointments = await this.prisma.appointment.count({
      where: {
        hospitalId,
        appointmentDate: { gte: startOfDay, lte: endOfDay },
      },
    });

    const completedEntries = await this.prisma.queueEntry.findMany({
      where: {
        queue: { hospitalId },
        status: QueueEntryStatus.COMPLETED,
        createdAt: { gte: startOfDay, lte: endOfDay },
      },
    });

    let totalWaitTimeMs = 0;
    let countedEntries = 0;

    for (const entry of completedEntries) {
      if (entry.estimatedStartTime) {
        const checkInTime = new Date(entry.createdAt).getTime();
        const startTime = new Date(entry.estimatedStartTime).getTime();
        const waitTime = startTime - checkInTime;
        if (waitTime > 0) {
          totalWaitTimeMs += waitTime;
          countedEntries++;
        }
      }
    }

    const avgWaitTimeMinutes = countedEntries > 0 
      ? Math.round(totalWaitTimeMs / (countedEntries * 60 * 1000))
      : 0;

    const allTodayEntries = await this.prisma.queueEntry.findMany({
      where: {
        queue: { hospitalId },
        createdAt: { gte: startOfDay, lte: endOfDay },
      },
      select: { createdAt: true },
    });

    const hourlyCounts = Array(24).fill(0);
    for (const entry of allTodayEntries) {
      const hour = new Date(entry.createdAt).getUTCHours();
      hourlyCounts[hour]++;
    }

    const peakHours = hourlyCounts.map((count, hour) => ({
      hour: `${hour.toString().padStart(2, '0')}:00`,
      count,
    }));

    const doctors = await this.prisma.doctor.findMany({
      where: { hospitalId },
      include: {
        availability: { where: { dayOfWeek: targetDate.getUTCDay() } },
        queues: {
          where: { date: startOfDay },
          include: {
            entries: {
              where: { status: QueueEntryStatus.COMPLETED },
            },
          },
        },
      },
    });

    const utilization = doctors.map((doc) => {
      let scheduledMinutes = 480;
      if (doc.availability.length > 0) {
        const da = doc.availability[0];
        const [sh, sm] = da.startTime.split(':').map(Number);
        const [eh, em] = da.endTime.split(':').map(Number);
        scheduledMinutes = (eh * 60 + em) - (sh * 60 + sm);
      }

      let consultingMinutes = 0;
      if (doc.queues.length > 0) {
        consultingMinutes = doc.queues[0].entries.reduce(
          (sum: number, entry: any) => sum + entry.estimatedDurationMinutes,
          0
        );
      }

      const utilizationRate = scheduledMinutes > 0
        ? Math.round((consultingMinutes / scheduledMinutes) * 100)
        : 0;

      return {
        doctorId: doc.id,
        doctorName: doc.fullName,
        specialization: doc.specialization,
        utilizationRate: Math.min(utilizationRate, 100),
      };
    });

    return {
      date: startOfDay.toISOString().split('T')[0],
      totalAppointments,
      avgWaitTimeMinutes,
      peakHours,
      doctorUtilization: utilization,
    };
  }
}
