import { IsEmail, IsNotEmpty, IsOptional, IsString, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'patient@example.com', required: false })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({ example: '+919876543210', required: false })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @IsNotEmpty()
  password!: string;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @ApiProperty({ example: '1990-01-01' })
  @IsDateString()
  @IsNotEmpty()
  dateOfBirth!: string;

  @ApiProperty({ example: 'Male' })
  @IsString()
  @IsNotEmpty()
  gender!: string;

  @ApiProperty({ example: '123 Main St, Bangalore', required: false })
  @IsString()
  @IsOptional()
  address?: string;
}
