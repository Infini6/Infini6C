import { IsDateString, IsNotEmpty, IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAppointmentDto {
  @ApiProperty({ example: 'hospital-uuid-here' })
  @IsString()
  @IsNotEmpty()
  hospitalId!: string;

  @ApiProperty({ example: 'department-uuid-here' })
  @IsString()
  @IsNotEmpty()
  departmentId!: string;

  @ApiProperty({ example: 'doctor-uuid-here' })
  @IsString()
  @IsNotEmpty()
  doctorId!: string;

  @ApiProperty({ example: 'service-uuid-here' })
  @IsString()
  @IsNotEmpty()
  serviceId!: string;

  @ApiProperty({ example: '2026-08-30T11:00:00.000Z' })
  @IsDateString()
  @IsNotEmpty()
  appointmentDate!: string;

  @ApiProperty({ example: 'patient-uuid-here', required: false })
  @IsString()
  @IsOptional()
  patientId?: string;
}
