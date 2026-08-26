import { IsBoolean, IsDateString, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class DoctorOverrideDto {
  @ApiProperty({ example: '2026-08-30' })
  @IsDateString()
  @IsNotEmpty()
  date!: string;

  @ApiProperty({ example: '09:00', required: false, description: 'HH:MM format' })
  @IsString()
  @IsOptional()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, { message: 'startTime must be in HH:MM format' })
  startTime?: string;

  @ApiProperty({ example: '13:00', required: false, description: 'HH:MM format' })
  @IsString()
  @IsOptional()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, { message: 'endTime must be in HH:MM format' })
  endTime?: string;

  @ApiProperty({ example: false, description: 'If false, doctor is completely unavailable' })
  @IsBoolean()
  @IsNotEmpty()
  isAvailable!: boolean;

  @ApiProperty({ example: 'Emergency shift change', required: false })
  @IsString()
  @IsOptional()
  reason?: string;
}
