import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationChannel, NotificationStatus } from '@prisma/client';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  @OnEvent('queue.patient_called')
  async handlePatientCalled(payload: {
    patientId: string;
    queueEntryId: string;
    doctorId: string;
    queueId: string;
  }) {
    this.logger.log(`Handling notification for patient called: ${payload.patientId}`);
    
    await this.sendNotification(
      payload.patientId,
      'Your Turn Has Arrived!',
      'You have been called to the consultation room. Please proceed immediately.',
      NotificationChannel.IN_APP,
    );

    await this.sendNotification(
      payload.patientId,
      'Smart Hospital Queue Update',
      'Your turn has arrived! Please proceed to the doctor room immediately.',
      NotificationChannel.SMS,
    );
  }

  @OnEvent('journey.updated')
  async handleJourneyUpdated(payload: {
    patientId: string;
    journeyId: string;
    currentStepIndex: number;
    status: string;
    nextInstruction: string;
  }) {
    this.logger.log(`Handling notification for journey updated: ${payload.patientId}`);

    await this.sendNotification(
      payload.patientId,
      'Journey Stage Updated',
      `Your next step: ${payload.nextInstruction}`,
      NotificationChannel.IN_APP,
    );
  }

  async sendNotification(
    patientId: string,
    title: string,
    message: string,
    channel: NotificationChannel,
  ) {
    const notif = await this.prisma.notification.create({
      data: {
        patientId,
        title,
        message,
        channel,
        status: NotificationStatus.PENDING,
      },
    });

    this.simulateDispatch(notif.id);
  }

  private async simulateDispatch(notificationId: string) {
    setTimeout(async () => {
      try {
        const notif = await this.prisma.notification.findUnique({
          where: { id: notificationId },
        });
        if (!notif) return;

        const success = Math.random() > 0.05;

        if (success) {
          await this.prisma.notification.update({
            where: { id: notificationId },
            data: { status: NotificationStatus.DELIVERED },
          });
          this.logger.log(`Notification ${notificationId} successfully delivered via ${notif.channel}`);
        } else {
          const newRetryCount = notif.retryCount + 1;
          const status = newRetryCount >= 3 ? NotificationStatus.FAILED : NotificationStatus.RETRYING;
          const nextRetryAt = status === NotificationStatus.RETRYING 
            ? new Date(Date.now() + 10000 * Math.pow(2, newRetryCount))
            : null;

          await this.prisma.notification.update({
            where: { id: notificationId },
            data: {
              status,
              retryCount: newRetryCount,
              nextRetryAt,
              errorLog: 'Transient mock gateway timeout',
            },
          });

          this.logger.warn(`Notification ${notificationId} failed dispatch. Status: ${status}. Retry count: ${newRetryCount}`);

          if (status === NotificationStatus.RETRYING) {
            this.scheduleRetry(notificationId, 10000 * Math.pow(2, newRetryCount));
          }
        }
      } catch (err: any) {
        this.logger.error(`Error in simulateDispatch for notification ${notificationId}: ${err.message}`);
      }
    }, 1000);
  }

  private scheduleRetry(notificationId: string, delayMs: number) {
    setTimeout(() => {
      this.simulateDispatch(notificationId);
    }, delayMs);
  }

  async getNotificationsForPatient(patientId: string) {
    return this.prisma.notification.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}
