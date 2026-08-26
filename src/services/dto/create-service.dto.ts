import { IsInt, IsNotEmpty, IsOptional, IsString, Min, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { EntityStatus } from '@prisma/client';

export class CreateServiceDto {
  @ApiProperty({ example: 'Consultation' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'CONS' })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiProperty({ example: 'Regular outpatient medical consultation', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 15, description: 'Estimated service duration in minutes' })
  @IsInt()
  @Min(1)
  estimatedDurationMinutes!: number;
}

export class UpdateServiceDto {
  @ApiProperty({ example: 'Specialist Consultation', required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ example: 'Detailed medical assessment', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 20, required: false })
  @IsInt()
  @Min(1)
  @IsOptional()
  estimatedDurationMinutes?: number;

  @ApiProperty({ enum: EntityStatus, required: false })
  @IsEnum(EntityStatus)
  @IsOptional()
  status?: EntityStatus;
}
