import { IsEmail, IsNotEmpty, IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class CreateStaffDto {
  @ApiProperty({ example: 'staff@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ example: '+919876543213', required: false })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @IsNotEmpty()
  password!: string;

  @ApiProperty({ example: 'Alice Johnson' })
  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @ApiProperty({ enum: [Role.RECEPTIONIST, Role.QUEUE_OPERATOR, Role.LAB_OPERATOR, Role.SCAN_OPERATOR, Role.HOSPITAL_ADMIN, Role.HOSPITAL_STAFF] })
  @IsEnum(Role)
  @IsNotEmpty()
  role!: Role;
}

export class UpdateStaffDto {
  @ApiProperty({ example: 'Alice Johnson', required: false })
  @IsString()
  @IsOptional()
  fullName?: string;

  @ApiProperty({ enum: [Role.RECEPTIONIST, Role.QUEUE_OPERATOR, Role.LAB_OPERATOR, Role.SCAN_OPERATOR, Role.HOSPITAL_ADMIN, Role.HOSPITAL_STAFF], required: false })
  @IsEnum(Role)
  @IsOptional()
  role?: Role;
}
