import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { Role, AppointmentStatus, QueueEntryStatus, StepStatus } from '@prisma/client';
import { RedisService } from './../src/redis/redis.service.js';

describe('Smart Hospital Integration Flow (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const testSuffix = Math.floor(Math.random() * 1000000).toString();
  const patientEmail = `patient_${testSuffix}@example.com`;
  const adminEmail = `admin_${testSuffix}@example.com`;
  const doctorEmail = `doctor_${testSuffix}@example.com`;
  const staffEmail = `staff_${testSuffix}@example.com`;

  let patientToken: string;
  let adminToken: string;
  let staffToken: string;

  let patientId: string;
  let hospitalId: string;
  let departmentId: string;
  let serviceId: string;
  let doctorId: string;
  let appointmentId: string;
  let queueId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(RedisService)
      .useValue({
        get: jest.fn(),
        set: jest.fn(),
        del: jest.fn(),
        acquireLock: jest.fn().mockResolvedValue(true),
        releaseLock: jest.fn().mockResolvedValue(undefined),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    // Cascade delete hospital will clean up departments, services, doctors, queues, appointments, journeys
    if (hospitalId) {
      await prisma.hospital.delete({ where: { id: hospitalId } });
    }
    // Clean up users
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [patientEmail, adminEmail, doctorEmail, staffEmail],
        },
      },
    });

    await app.close();
  });

  it('1. Register test users and promote admin', async () => {
    // A. Register Patient
    const resPatient = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: patientEmail,
        password: 'password123',
        fullName: 'Test Patient',
        dateOfBirth: '1995-05-15',
        gender: 'MALE',
      })
      .expect(201);

    expect(resPatient.body.success).toBe(true);

    // B. Register Admin (initially registers as patient, then we promote in DB)
    const resAdmin = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: adminEmail,
        password: 'password123',
        fullName: 'Test Admin',
        dateOfBirth: '1980-01-01',
        gender: 'FEMALE',
      })
      .expect(201);

    expect(resAdmin.body.success).toBe(true);

    // Promote admin in database
    const adminUser = await prisma.user.findUnique({ where: { email: adminEmail } });
    await prisma.user.update({
      where: { id: adminUser!.id },
      data: { role: Role.PLATFORM_ADMIN },
    });
  });

  it('2. Login to retrieve access tokens', async () => {
    // Patient Login
    const resPatLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: patientEmail, password: 'password123' })
      .expect(200);

    patientToken = resPatLogin.body.data.accessToken;
    patientId = resPatLogin.body.data.user.patientProfile.id;
    expect(patientToken).toBeDefined();

    // Admin Login
    const resAdmLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: adminEmail, password: 'password123' })
      .expect(200);

    adminToken = resAdmLogin.body.data.accessToken;
    expect(adminToken).toBeDefined();
  });

  it('3. Admin configures Hospital, Department, and Service', async () => {
    // Create Hospital
    const resHosp = await request(app.getHttpServer())
      .post('/api/v1/hospitals')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Integration Test Hospital ${testSuffix}`,
        address: '123 Main Street',
        phone: '+919876543210',
        latitude: 12.9716,
        longitude: 77.5946,
      });

    if (resHosp.status !== 201) {
      console.log('Test 3 Failed! Status:', resHosp.status, 'Body:', JSON.stringify(resHosp.body, null, 2));
      console.log('Admin token used:', adminToken);
    }

    expect(resHosp.status).toBe(201);

    hospitalId = resHosp.body.data.id;
    expect(hospitalId).toBeDefined();

    // Create Operating Hours
    const todayDayOfWeek = new Date().getUTCDay();
    await prisma.hospitalOperatingHours.create({
      data: {
        hospitalId,
        dayOfWeek: todayDayOfWeek,
        openTime: '00:00',
        closeTime: '23:59',
      },
    });

    // Create Department
    const resDept = await request(app.getHttpServer())
      .post(`/api/v1/hospitals/${hospitalId}/departments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'General Medicine',
        code: `GEN_MED_${testSuffix}`,
        location: 'Block A, 1st Floor',
      })
      .expect(201);

    departmentId = resDept.body.data.id;
    expect(departmentId).toBeDefined();

    // Create Service
    const resServ = await request(app.getHttpServer())
      .post(`/api/v1/hospitals/${hospitalId}/services`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'General Consultation',
        code: `GEN_CONS_${testSuffix}`,
        description: 'Standard outpatient consult',
        estimatedDurationMinutes: 15,
      })
      .expect(201);

    serviceId = resServ.body.data.id;
    expect(serviceId).toBeDefined();
  });

  it('4. Admin registers a Doctor and configures schedule', async () => {
    // Register Doctor
    const resDoc = await request(app.getHttpServer())
      .post(`/api/v1/hospitals/${hospitalId}/doctors`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: doctorEmail,
        password: 'password123',
        fullName: 'Dr. John Watson',
        specialization: 'Internal Medicine',
        departmentIds: [departmentId],
      })
      .expect(201);

    doctorId = resDoc.body.data.id;
    expect(doctorId).toBeDefined();

    // Set Doctor Availability for today
    const todayDayOfWeek = new Date().getUTCDay();
    await request(app.getHttpServer())
      .post(`/api/v1/hospitals/${hospitalId}/doctors/${doctorId}/availability`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        dayOfWeek: todayDayOfWeek,
        startTime: '00:00',
        endTime: '23:59',
      })
      .expect(201);
  });

  it('5. Admin registers a Staff member', async () => {
    // Register Receptionist
    const resStaff = await request(app.getHttpServer())
      .post(`/api/v1/hospitals/${hospitalId}/staff`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: staffEmail,
        password: 'password123',
        fullName: 'Receptionist Jane',
        role: Role.RECEPTIONIST,
      })
      .expect(201);

    const staffProfile = resStaff.body.data.profile;
    expect(staffProfile).toBeDefined();

    // Promote staff's hospital scope inside DB so they pass guard checks
    await prisma.hospitalStaff.update({
      where: { id: staffProfile.id },
      data: { hospitalId },
    });

    // Login staff
    const resStaffLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: staffEmail, password: 'password123' })
      .expect(200);

    staffToken = resStaffLogin.body.data.accessToken;
    expect(staffToken).toBeDefined();
  });

  it('6. Patient books an appointment and verifies double-booking check', async () => {
    const today = new Date();
    // 14:00 today
    const apptDate = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate(), 14, 0, 0, 0));

    // A. Successful Booking
    const resAppt = await request(app.getHttpServer())
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({
        hospitalId,
        departmentId,
        doctorId,
        serviceId,
        appointmentDate: apptDate.toISOString(),
      });

    if (resAppt.status !== 201) {
      console.log('Test 6 Failed! Status:', resAppt.status, 'Body:', JSON.stringify(resAppt.body, null, 2));
      console.log('IDs used:', { hospitalId, departmentId, doctorId, serviceId, patientId });
    }

    expect(resAppt.status).toBe(201);

    appointmentId = resAppt.body.data.id;
    expect(appointmentId).toBeDefined();
    expect(resAppt.body.data.status).toBe(AppointmentStatus.CONFIRMED);

    // B. Concurrency check: try booking the exact same overlapping slot
    await request(app.getHttpServer())
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({
        hospitalId,
        departmentId,
        doctorId,
        serviceId,
        appointmentDate: apptDate.toISOString(),
      })
      .expect(409); // Conflict double-booking!
  });

  it('7. Patient check-in and queue placement', async () => {
    const resCheckIn = await request(app.getHttpServer())
      .post('/api/v1/check-in')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ appointmentId })
      .expect(201);

    expect(resCheckIn.body.success).toBe(true);
    expect(resCheckIn.body.data.queueEntry).toBeDefined();
    expect(resCheckIn.body.data.queueEntry.status).toBe(QueueEntryStatus.WAITING);
    expect(resCheckIn.body.data.queueEntry.position).toBe(1);

    queueId = resCheckIn.body.data.queueEntry.queueId;
  });

  it('8. Verify patient journey initialized and steps state query', async () => {
    const resJourney = await request(app.getHttpServer())
      .get(`/api/v1/appointments/${appointmentId}/journey`)
      .set('Authorization', `Bearer ${patientToken}`)
      .expect(200);

    expect(resJourney.body.success).toBe(true);
    expect(resJourney.body.data.status).toBe('IN_PROGRESS');
    expect(resJourney.body.data.steps.length).toBeGreaterThan(0);
    expect(resJourney.body.data.steps[0].stepName).toBe('Check-in');
    expect(resJourney.body.data.steps[0].status).toBe(StepStatus.COMPLETED);
  });

  it('9. Staff operates the queue: calls, starts, and completes care', async () => {
    // A. Call patient
    const resCall = await request(app.getHttpServer())
      .post(`/api/v1/hospitals/${hospitalId}/queues/${queueId}/call-next`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(201);

    expect(resCall.body.data.status).toBe(QueueEntryStatus.CALLED);
    const entryId = resCall.body.data.id;

    // B. Start consultation
    const resStart = await request(app.getHttpServer())
      .post(`/api/v1/hospitals/${hospitalId}/queue-entries/${entryId}/start`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(201);

    expect(resStart.body.data.status).toBe(QueueEntryStatus.IN_PROGRESS);

    // C. Complete consultation
    const resComplete = await request(app.getHttpServer())
      .post(`/api/v1/hospitals/${hospitalId}/queue-entries/${entryId}/complete`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(201);

    expect(resComplete.body.data.status).toBe(QueueEntryStatus.COMPLETED);
  });

  it('10. Admin queries analytics metrics', async () => {
    const resAnalytics = await request(app.getHttpServer())
      .get(`/api/v1/hospitals/${hospitalId}/analytics/dashboard`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(resAnalytics.body.success).toBe(true);
    expect(resAnalytics.body.data.totalAppointments).toBe(1);
    expect(resAnalytics.body.data.peakHours).toBeDefined();
    expect(resAnalytics.body.data.doctorUtilization.length).toBeGreaterThan(0);
  });
});
