import { IsDateString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RescheduleAppointmentDto {
  @ApiProperty({ example: '2026-08-30T11:30:00.000Z' })
  @IsDateString()
  @IsNotEmpty()
  newAppointmentDate!: string;
}
