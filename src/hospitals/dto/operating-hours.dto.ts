import { IsInt, IsNotEmpty, IsString, Max, Min, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SetOperatingHoursDto {
  @ApiProperty({ example: 1, description: '0 = Sunday, 6 = Saturday' })
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  @ApiProperty({ example: '08:00', description: 'HH:MM format' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, { message: 'openTime must be in HH:MM format' })
  openTime!: string;

  @ApiProperty({ example: '20:00', description: 'HH:MM format' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, { message: 'closeTime must be in HH:MM format' })
  closeTime!: string;
}
