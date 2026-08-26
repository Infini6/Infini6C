import { IsEmail, IsNotEmpty, IsString, IsOptional, IsArray, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { DoctorStatus } from '@prisma/client';

export class CreateDoctorDto {
  @ApiProperty({ example: 'doctor@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ example: '+919876543212', required: false })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @IsNotEmpty()
  password!: string;

  @ApiProperty({ example: 'Dr. Jane Smith' })
  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @ApiProperty({ example: 'Cardiology' })
  @IsString()
  @IsNotEmpty()
  specialization!: string;

  @ApiProperty({ example: ['dept-uuid-1'], description: 'Array of department IDs to link' })
  @IsArray()
  @IsString({ each: true })
  departmentIds!: string[];
}

export class UpdateDoctorDto {
  @ApiProperty({ example: 'Dr. Jane Smith', required: false })
  @IsString()
  @IsOptional()
  fullName?: string;

  @ApiProperty({ example: 'Pediatric Cardiology', required: false })
  @IsString()
  @IsOptional()
  specialization?: string;

  @ApiProperty({ enum: DoctorStatus, required: false })
  @IsEnum(DoctorStatus)
  @IsOptional()
  status?: DoctorStatus;
}
