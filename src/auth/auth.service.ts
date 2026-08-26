import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service.js';
import { PatientsService } from '../patients/patients.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { Role, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomUUID } from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly patientsService: PatientsService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    if (!dto.email && !dto.phone) {
      throw new ConflictException('Either email or phone number must be provided');
    }

    const passwordHash = await argon2.hash(dto.password);

    return this.prisma.$transaction(async (tx) => {
      // Check if email already registered
      if (dto.email) {
        const existingEmail = await tx.user.findUnique({ where: { email: dto.email } });
        if (existingEmail) {
          throw new ConflictException('Email already registered');
        }
      }

      // Check if phone already registered
      if (dto.phone) {
        const existingPhone = await tx.user.findUnique({ where: { phone: dto.phone } });
        if (existingPhone) {
          throw new ConflictException('Phone number already registered');
        }
      }

      const user = await tx.user.create({
        data: {
          email: dto.email || null,
          phone: dto.phone || null,
          passwordHash,
          role: Role.PATIENT,
          status: UserStatus.ACTIVE,
        },
      });

      const patient = await tx.patient.create({
        data: {
          userId: user.id,
          fullName: dto.fullName,
          dateOfBirth: new Date(dto.dateOfBirth),
          gender: dto.gender,
          address: dto.address || null,
        },
      });

      return {
        userId: user.id,
        patientId: patient.id,
        email: user.email,
        phone: user.phone,
        fullName: patient.fullName,
      };
    });
  }

  async login(dto: LoginDto, deviceFingerprint?: string, ipAddress?: string) {
    if (!dto.email && !dto.phone) {
      throw new UnauthorizedException('Either email or phone number must be provided');
    }

    let user: any = null;
    if (dto.email) {
      user = await this.prisma.user.findUnique({
        where: { email: dto.email },
        include: {
          patientProfile: true,
          doctorProfile: true,
          adminProfile: true,
          staffProfile: true,
        },
      });
    } else if (dto.phone) {
      user = await this.prisma.user.findUnique({
        where: { phone: dto.phone },
        include: {
          patientProfile: true,
          doctorProfile: true,
          adminProfile: true,
          staffProfile: true,
        },
      });
    }

    if (!user) {
      throw new UnauthorizedException('Invalid login credentials');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('User account is inactive or suspended');
    }

    const isPasswordValid = await argon2.verify(user.passwordHash, dto.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid login credentials');
    }

    const payload = this.generatePayload(user);
    const accessToken = await this.generateAccessToken(payload);
    const refreshToken = await this.generateRefreshToken();

    const refreshTokenHash = await argon2.hash(refreshToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.refreshSession.create({
      data: {
        userId: user.id,
        refreshTokenHash,
        deviceFingerprint: deviceFingerprint || null,
        ipAddress: ipAddress || null,
        expiresAt,
      },
    });

    await this.usersService.updateLastLogin(user.id);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        role: user.role,
        fullName: payload.fullName,
        patientId: payload.patientId || null,
        hospitalId: payload.hospitalId || null,
        doctorId: payload.doctorId || null,
      },
    };
  }

  async refresh(refreshToken: string, deviceFingerprint?: string, ipAddress?: string) {
    const sessions = await this.prisma.refreshSession.findMany({
      where: {
        isValid: true,
        expiresAt: { gt: new Date() },
      },
      include: {
        user: {
          include: {
            patientProfile: true,
            doctorProfile: true,
            adminProfile: true,
            staffProfile: true,
          },
        },
      },
    });

    let matchedSession: any = null;
    for (const session of sessions) {
      const isMatch = await argon2.verify(session.refreshTokenHash, refreshToken);
      if (isMatch) {
        matchedSession = session;
        break;
      }
    }

    if (!matchedSession) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    await this.prisma.refreshSession.update({
      where: { id: matchedSession.id },
      data: { isValid: false },
    });

    const user = matchedSession.user;
    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('User account is inactive or suspended');
    }

    const payload = this.generatePayload(user);
    const newAccessToken = await this.generateAccessToken(payload);
    const newRefreshToken = await this.generateRefreshToken();

    const newRefreshTokenHash = await argon2.hash(newRefreshToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.refreshSession.create({
      data: {
        userId: user.id,
        refreshTokenHash: newRefreshTokenHash,
        deviceFingerprint: deviceFingerprint || matchedSession.deviceFingerprint,
        ipAddress: ipAddress || matchedSession.ipAddress,
        expiresAt,
      },
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  async logout(refreshToken: string) {
    const sessions = await this.prisma.refreshSession.findMany({
      where: { isValid: true },
    });

    for (const session of sessions) {
      const isMatch = await argon2.verify(session.refreshTokenHash, refreshToken);
      if (isMatch) {
        await this.prisma.refreshSession.update({
          where: { id: session.id },
          data: { isValid: false },
        });
        return { success: true };
      }
    }

    throw new UnauthorizedException('Invalid refresh token');
  }

  private generatePayload(user: any) {
    const payload: any = {
      userId: user.id,
      role: user.role,
    };

    const isStaffRole = [
      Role.RECEPTIONIST,
      Role.QUEUE_OPERATOR,
      Role.LAB_OPERATOR,
      Role.SCAN_OPERATOR,
      Role.HOSPITAL_STAFF
    ].includes(user.role);

    if (user.role === Role.PATIENT && user.patientProfile) {
      payload.patientId = user.patientProfile.id;
      payload.fullName = user.patientProfile.fullName;
    } else if (user.role === Role.DOCTOR && user.doctorProfile) {
      payload.doctorId = user.doctorProfile.id;
      payload.hospitalId = user.doctorProfile.hospitalId;
      payload.fullName = user.doctorProfile.fullName;
    } else if (user.role === Role.HOSPITAL_ADMIN && user.adminProfile) {
      payload.hospitalId = user.adminProfile.hospitalId;
      payload.fullName = user.adminProfile.fullName;
    } else if (isStaffRole && user.staffProfile) {
      payload.hospitalId = user.staffProfile.hospitalId;
      payload.fullName = user.staffProfile.fullName;
    } else if (user.role === Role.PLATFORM_ADMIN) {
      payload.fullName = 'Platform Administrator';
    }

    return payload;
  }

  private async generateAccessToken(payload: any): Promise<string> {
    const secret = this.configService.get<string>('jwt.accessSecret');
    return this.jwtService.signAsync(payload, {
      secret,
      expiresIn: '15m',
    });
  }

  private async generateRefreshToken(): Promise<string> {
    return randomUUID() + randomUUID();
  }
}
