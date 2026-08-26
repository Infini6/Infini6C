import { IsInt, Max, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SetPriorityDto {
  @ApiProperty({ example: 2, description: '0 = NORMAL, 1 = PRIORITY, 2 = EMERGENCY' })
  @IsInt()
  @Min(0)
  @Max(2)
  priority!: number;
}
