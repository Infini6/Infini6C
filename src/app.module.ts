import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import configuration from './config/configuration.js';
import { validate } from './config/validation.schema.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { RedisModule } from './redis/redis.module.js';
import { HealthModule } from './health/health.module.js';
import { AuthModule } from './auth/auth.module.js';
import { HospitalsModule } from './hospitals/hospitals.module.js';
import { DepartmentsModule } from './departments/departments.module.js';
import { ServicesModule } from './services/services.module.js';
import { DoctorsModule } from './doctors/doctors.module.js';
import { StaffModule } from './staff/staff.module.js';
import { AppointmentsModule } from './appointments/appointments.module.js';
import { QueuesModule } from './queues/queues.module.js';
import { PatientJourneyModule } from './patient-journey/patient-journey.module.js';
import { NavigationModule } from './navigation/navigation.module.js';
import { RealtimeModule } from './realtime/realtime.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { PaymentsModule } from './payments/payments.module.js';
import { AuditingModule } from './auditing/auditing.module.js';
import { AnalyticsModule } from './analytics/analytics.module.js';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate,
    }),
    EventEmitterModule.forRoot(),
    PrismaModule,
    RedisModule,
    HealthModule,
    AuthModule,
    HospitalsModule,
    DepartmentsModule,
    ServicesModule,
    DoctorsModule,
    StaffModule,
    AppointmentsModule,
    QueuesModule,
    PatientJourneyModule,
    NavigationModule,
    RealtimeModule,
    NotificationsModule,
    PaymentsModule,
    AuditingModule,
    AnalyticsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
