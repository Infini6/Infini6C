import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let code = 'INTERNAL_SERVER_ERROR';
    let details: any = {};

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse() as any;
      if (typeof exceptionResponse === 'object') {
        message = Array.isArray(exceptionResponse.message)
          ? exceptionResponse.message[0]
          : exceptionResponse.message || exceptionResponse.error || message;
        code = exceptionResponse.code || exception.name.replace(/Exception$/, '').toUpperCase() || code;
        details = exceptionResponse.details || exceptionResponse;
      } else {
        message = exceptionResponse || message;
      }
    } else if (exception && typeof exception === 'object' && exception.code && exception.message) {
      if (typeof exception.code === 'string' && exception.code.startsWith('P')) {
        status = HttpStatus.BAD_REQUEST;
        message = 'Database operation failed';
        code = `DB_ERROR_${exception.code}`;
        details = { meta: exception.meta };
      } else {
        message = exception.message;
        code = exception.code;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      code = exception.name.toUpperCase();
    }

    const requestId = request.headers['x-request-id'] || 'N/A';

    if (details && details.message && Array.isArray(details.message)) {
      message = 'Validation failed';
      code = 'VALIDATION_FAILED';
      details = { validationErrors: details.message };
    }

    response.status(status).json({
      success: false,
      error: {
        code,
        message,
        details,
        requestId,
      },
    });
  }
}
