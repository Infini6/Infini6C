import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Role, User, UserStatus } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findByPhone(phone: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { phone },
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async createUser(data: {
    email?: string;
    phone?: string;
    passwordHash: string;
    role: Role;
    status?: UserStatus;
  }): Promise<User> {
    if (data.email) {
      const existingEmail = await this.findByEmail(data.email);
      if (existingEmail) {
        throw new ConflictException('Email already exists');
      }
    }
    if (data.phone) {
      const existingPhone = await this.findByPhone(data.phone);
      if (existingPhone) {
        throw new ConflictException('Phone number already exists');
      }
    }

    return this.prisma.user.create({
      data,
    });
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { lastLoginAt: new Date() },
    });
  }
}
