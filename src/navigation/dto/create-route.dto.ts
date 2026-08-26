import { IsNotEmpty, IsString, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateRouteDto {
  @ApiProperty({ example: 'Lobby to Radiology' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'Lobby' })
  @IsString()
  @IsNotEmpty()
  startPoint!: string;

  @ApiProperty({ example: 'Radiology' })
  @IsString()
  @IsNotEmpty()
  endPoint!: string;

  @ApiProperty({
    example: [
      { x: 10, y: 15, instruction: 'Go straight' },
      { x: 20, y: 35, instruction: 'Turn right at Pharmacy' },
    ],
  })
  @IsArray()
  @IsNotEmpty()
  steps!: any;
}
