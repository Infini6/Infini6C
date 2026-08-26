import { IsEmail, IsNotEmpty, IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { HospitalStatus } from '@prisma/client';

export class CreateHospitalDto {
  @ApiProperty({ example: 'City Hospital' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'CH001' })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiProperty({ example: '123 Health St, Bangalore' })
  @IsString()
  @IsNotEmpty()
  address!: string;

  @ApiProperty({ example: '+919876543210' })
  @IsString()
  @IsNotEmpty()
  contactNumber!: string;

  @ApiProperty({ example: 'info@cityhospital.com' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ example: 'Asia/Kolkata', default: 'UTC' })
  @IsString()
  @IsOptional()
  timezone?: string;
}

export class UpdateHospitalDto {
  @ApiProperty({ example: 'City General Hospital', required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ example: '123 Medical Rd, Bangalore', required: false })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiProperty({ example: '+919876543211', required: false })
  @IsString()
  @IsOptional()
  contactNumber?: string;

  @ApiProperty({ example: 'contact@cityhospital.com', required: false })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({ example: 'Asia/Kolkata', required: false })
  @IsString()
  @IsOptional()
  timezone?: string;

  @ApiProperty({ enum: HospitalStatus, required: false })
  @IsEnum(HospitalStatus)
  @IsOptional()
  status?: HospitalStatus;
}
