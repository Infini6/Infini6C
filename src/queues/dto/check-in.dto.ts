import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CheckInDto {
  @ApiProperty({ example: 'appt-uuid-here', description: 'Can be scanned from the QR code' })
  @IsString()
  @IsNotEmpty()
  appointmentId!: string;
}
