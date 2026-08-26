import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { PaymentWebhookDto } from './dto/payment-webhook.dto.js';
import { PaymentStatus, AppointmentStatus } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async processWebhook(dto: PaymentWebhookDto) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: dto.paymentId },
      include: { appointment: true },
    });

    if (!payment) {
      throw new NotFoundException(`Payment record with ID ${dto.paymentId} not found`);
    }

    if (payment.status === PaymentStatus.SUCCESS) {
      return { success: true, message: 'Payment already processed' };
    }

    const nextPaymentStatus =
      dto.status.toUpperCase() === 'SUCCESS' ? PaymentStatus.SUCCESS : PaymentStatus.FAILED;

    return this.prisma.$transaction(async (tx) => {
      const updatedPayment = await tx.payment.update({
        where: { id: dto.paymentId },
        data: {
          status: nextPaymentStatus,
          providerTransactionId: dto.transactionId,
        },
      });

      if (nextPaymentStatus === PaymentStatus.SUCCESS) {
        await tx.appointment.update({
          where: { id: payment.appointmentId },
          data: { status: AppointmentStatus.CONFIRMED },
        });

        await tx.appointmentStatusHistory.create({
          data: {
            appointmentId: payment.appointmentId,
            fromStatus: payment.appointment.status,
            toStatus: AppointmentStatus.CONFIRMED,
            changedByUserId: 'SYSTEM_PAYMENT_GATEWAY',
            reason: 'Payment confirmed successfully via webhook',
          },
        });
      }

      this.eventEmitter.emit('payment.processed', {
        paymentId: dto.paymentId,
        appointmentId: payment.appointmentId,
        status: nextPaymentStatus,
      });

      return updatedPayment;
    });
  }
}
