import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<Request>();
    const response = httpContext.getResponse<Response>();

    const method = request.method;
    const url = request.url;
    const requestId = request.headers['x-request-id'] || 'N/A';
    const user = (request as any).user;
    const userId = user ? user.userId : 'anonymous';
    const role = user ? user.role : 'none';

    const now = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - now;
          const status = response.statusCode;
          this.logger.log(
            JSON.stringify({
              requestId,
              timestamp: new Date().toISOString(),
              userId,
              role,
              method,
              url,
              status,
              duration: `${duration}ms`,
            }),
          );
        },
        error: (err: any) => {
          const duration = Date.now() - now;
          const status = err.status || 500;
          this.logger.error(
            JSON.stringify({
              requestId,
              timestamp: new Date().toISOString(),
              userId,
              role,
              method,
              url,
              status,
              duration: `${duration}ms`,
              errorMessage: err.message || 'Internal Server Error',
            }),
          );
        },
      }),
    );
  }
}
