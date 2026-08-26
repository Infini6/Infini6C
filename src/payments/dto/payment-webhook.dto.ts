import { IsNotEmpty, IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PaymentWebhookDto {
  @ApiProperty({ example: 'payment-uuid-or-id' })
  @IsString()
  @IsNotEmpty()
  paymentId!: string;

  @ApiProperty({ example: 'pay_txn_123456' })
  @IsString()
  @IsNotEmpty()
  transactionId!: string;

  @ApiProperty({ example: 'SUCCESS', description: 'SUCCESS or FAILED' })
  @IsString()
  @IsNotEmpty()
  status!: string;

  @ApiProperty({ example: 'payment_intent.succeeded', required: false })
  @IsString()
  @IsOptional()
  eventType?: string;
}
