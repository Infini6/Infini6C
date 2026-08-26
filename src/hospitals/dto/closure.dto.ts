import { IsDateString, IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ClosureType } from '@prisma/client';

export class CreateClosureDto {
  @ApiProperty({ example: '2026-12-25T00:00:00.000Z' })
  @IsDateString()
  @IsNotEmpty()
  startDate!: string;

  @ApiProperty({ example: '2026-12-25T23:59:59.000Z' })
  @IsDateString()
  @IsNotEmpty()
  endDate!: string;

  @ApiProperty({ example: 'Christmas holiday' })
  @IsString()
  @IsNotEmpty()
  reason!: string;

  @ApiProperty({ enum: ClosureType, example: ClosureType.HOLIDAY })
  @IsEnum(ClosureType)
  @IsNotEmpty()
  type!: ClosureType;
}
