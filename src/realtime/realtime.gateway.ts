import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { OnEvent } from '@nestjs/event-emitter';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/ws',
})
export class RealtimeGateway {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  @SubscribeMessage('join_hospital_queues')
  handleJoinHospital(
    @MessageBody() data: { hospitalId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = `hospital:${data.hospitalId}:queues`;
    client.join(room);
    this.logger.log(`Client ${client.id} joined room ${room}`);
    return { status: 'joined', room };
  }

  @SubscribeMessage('join_patient_updates')
  handleJoinPatient(
    @MessageBody() data: { patientId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = `patient:${data.patientId}`;
    client.join(room);
    this.logger.log(`Client ${client.id} joined room ${room}`);
    return { status: 'joined', room };
  }

  @SubscribeMessage('join_queue')
  handleJoinQueue(
    @MessageBody() data: { queueId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = `queue:${data.queueId}`;
    client.join(room);
    this.logger.log(`Client ${client.id} joined room ${room}`);
    return { status: 'joined', room };
  }

  @OnEvent('queue.updated')
  handleQueueUpdated(payload: { queueId: string }) {
    const room = `queue:${payload.queueId}`;
    this.server.to(room).emit('queue_updated', payload);
    this.logger.log(`Broadcasted queue.updated to room ${room}`);
  }

  @OnEvent('queue.patient_called')
  handlePatientCalled(payload: {
    patientId: string;
    queueEntryId: string;
    doctorId: string;
    queueId: string;
  }) {
    const patientRoom = `patient:${payload.patientId}`;
    this.server.to(patientRoom).emit('patient_called', payload);

    const queueRoom = `queue:${payload.queueId}`;
    this.server.to(queueRoom).emit('queue_updated', payload);

    this.logger.log(`Broadcasted patient called to rooms: ${patientRoom}, ${queueRoom}`);
  }

  @OnEvent('journey.updated')
  handleJourneyUpdated(payload: {
    patientId: string;
    journeyId: string;
    currentStepIndex: number;
    status: string;
    nextInstruction: string;
  }) {
    const patientRoom = `patient:${payload.patientId}`;
    this.server.to(patientRoom).emit('journey_updated', payload);
    this.logger.log(`Broadcasted journey.updated to room ${patientRoom}`);
  }
}
