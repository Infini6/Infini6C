import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PaymentsService } from './payments.service.js';
import { PaymentWebhookDto } from './dto/payment-webhook.dto.js';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive and process gateway webhooks' })
  async handleWebhook(@Body() dto: PaymentWebhookDto) {
    const result = await this.paymentsService.processWebhook(dto);
    return {
      success: true,
      message: 'Webhook processed successfully',
      data: result,
    };
  }
}
