import { IsInt, IsNotEmpty, IsString, Max, Min, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class DoctorAvailabilityDto {
  @ApiProperty({ example: 1, description: '0 = Sunday, 6 = Saturday' })
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  @ApiProperty({ example: '09:00', description: 'HH:MM format' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, { message: 'startTime must be in HH:MM format' })
  startTime!: string;

  @ApiProperty({ example: '17:00', description: 'HH:MM format' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, { message: 'endTime must be in HH:MM format' })
  endTime!: string;
}
