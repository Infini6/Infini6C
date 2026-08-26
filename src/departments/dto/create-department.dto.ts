import { IsNotEmpty, IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { EntityStatus } from '@prisma/client';

export class CreateDepartmentDto {
  @ApiProperty({ example: 'Cardiology' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'CARD' })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiProperty({ example: 'Heart and vascular care unit', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 'Block B, Floor 2', required: false })
  @IsString()
  @IsOptional()
  location?: string;
}

export class UpdateDepartmentDto {
  @ApiProperty({ example: 'Cardiology Unit', required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ example: 'Heart diseases department description', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 'Block B, Floor 3', required: false })
  @IsString()
  @IsOptional()
  location?: string;

  @ApiProperty({ enum: EntityStatus, required: false })
  @IsEnum(EntityStatus)
  @IsOptional()
  status?: EntityStatus;
}
