import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { JourneyStatus, StepStatus, PatientJourney } from '@prisma/client';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';

@Injectable()
export class PatientJourneyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @OnEvent('patient.checked_in')
  async handlePatientCheckedIn(payload: { appointmentId: string; actorUserId: string }) {
    try {
      await this.initializeJourney(payload.appointmentId);
    } catch (err) {
      console.error('Failed to initialize patient journey:', err);
    }
  }

  async initializeJourney(appointmentId: string): Promise<PatientJourney> {
    const appt = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { doctor: true, service: true, department: true },
    });

    if (!appt) {
      throw new NotFoundException('Appointment not found');
    }

    const isScanWorkflow = appt.service.code.toUpperCase().includes('SCAN');

    const stepsData: Array<{
      stepName: string;
      orderIndex: number;
      status: StepStatus;
      location: string;
      instruction: string;
      estimatedDurationMinutes: number;
      actualStartTime?: Date;
      actualEndTime?: Date;
    }> = [
      {
        stepName: 'Check-in',
        orderIndex: 1,
        status: StepStatus.COMPLETED,
        location: 'Hospital Entrance / Kiosk',
        instruction: 'Arrived and checked-in. Proceed to the vitals desk.',
        estimatedDurationMinutes: 5,
        actualStartTime: new Date(),
        actualEndTime: new Date(),
      },
      {
        stepName: 'Vitals Measurement',
        orderIndex: 2,
        status: StepStatus.READY,
        location: 'OP Department Vitals Desk',
        instruction: 'Get your blood pressure, weight, and temperature checked by the nurse.',
        estimatedDurationMinutes: 10,
      },
    ];

    if (isScanWorkflow) {
      stepsData.push({
        stepName: 'Radiology Scan',
        orderIndex: 3,
        status: StepStatus.PENDING,
        location: 'Radiology Scan Room 204',
        instruction: 'Proceed to the Radiology department for your scan.',
        estimatedDurationMinutes: 30,
      });
      stepsData.push({
        stepName: 'Doctor Consultation',
        orderIndex: 4,
        status: StepStatus.PENDING,
        location: appt.department.location || `OP Room of ${appt.doctor.fullName}`,
        instruction: `Consultation with ${appt.doctor.fullName} to review results.`,
        estimatedDurationMinutes: 20,
      });
    } else {
      stepsData.push({
        stepName: 'Doctor Consultation',
        orderIndex: 3,
        status: StepStatus.PENDING,
        location: appt.department.location || `OP Room of ${appt.doctor.fullName}`,
        instruction: `Consultation with ${appt.doctor.fullName}.`,
        estimatedDurationMinutes: 15,
      });
    }

    stepsData.push({
      stepName: 'Report Collection / Pharmacy',
      orderIndex: stepsData.length + 1,
      status: StepStatus.PENDING,
      location: 'Pharmacy Counter 3',
      instruction: 'Collect your medicine and print your prescription reports.',
      estimatedDurationMinutes: 10,
    });

    return this.prisma.patientJourney.create({
      data: {
        appointmentId,
        patientId: appt.patientId,
        status: JourneyStatus.IN_PROGRESS,
        steps: {
          create: stepsData,
        },
      },
      include: { steps: true },
    });
  }

  async getJourneyByAppointment(appointmentId: string): Promise<PatientJourney> {
    const journey = await this.prisma.patientJourney.findUnique({
      where: { appointmentId },
      include: {
        steps: { orderBy: { orderIndex: 'asc' } },
        appointment: { include: { doctor: true, service: true, department: true } },
      },
    });

    if (!journey) {
      throw new NotFoundException('Patient journey not found for this appointment');
    }

    return journey;
  }

  async advanceStep(journeyId: string, stepId: string, actorUserId: string) {
    const journey = await this.prisma.patientJourney.findUnique({
      where: { id: journeyId },
      include: { steps: { orderBy: { orderIndex: 'asc' } } },
    });

    if (!journey) {
      throw new NotFoundException('Journey not found');
    }

    const currentStep = journey.steps.find((s) => s.id === stepId);
    if (!currentStep) {
      throw new NotFoundException('Step not found in this journey');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.journeyStep.update({
        where: { id: stepId },
        data: {
          status: StepStatus.COMPLETED,
          actualEndTime: new Date(),
        },
      });

      const nextStep = journey.steps.find(
        (s) => s.orderIndex === currentStep.orderIndex + 1
      );

      if (nextStep) {
        await tx.journeyStep.update({
          where: { id: nextStep.id },
          data: {
            status: StepStatus.READY,
            actualStartTime: new Date(),
          },
        });
      } else {
        await tx.patientJourney.update({
          where: { id: journeyId },
          data: { status: JourneyStatus.COMPLETED },
        });
      }

      const updatedJourney = await tx.patientJourney.findUnique({
        where: { id: journeyId },
        include: { steps: { orderBy: { orderIndex: 'asc' } } },
      });

      this.eventEmitter.emit('journey.updated', {
        patientId: journey.patientId,
        journeyId,
        currentStepIndex: nextStep ? nextStep.orderIndex - 1 : journey.steps.length,
        status: nextStep ? JourneyStatus.IN_PROGRESS : JourneyStatus.COMPLETED,
        nextInstruction: nextStep ? nextStep.instruction : 'Journey completed. Get well soon!',
      });

      return updatedJourney;
    });
  }
}
