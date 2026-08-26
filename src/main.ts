import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);

  // 1. Enable Global Prefix (exclude health checks)
  app.setGlobalPrefix('api/v1', {
    exclude: ['health', 'health/database', 'health/redis'],
  });

  // 2. Cookie Parser
  app.use(cookieParser());

  // 3. Helmet for security headers
  app.use(helmet());

  // 4. CORS configuration
  const patientUrl = configService.get<string>('cors.patientFrontendUrl');
  const hospitalUrl = configService.get<string>('cors.hospitalFrontendUrl');
  const adminUrl = configService.get<string>('cors.adminFrontendUrl');

  app.enableCors({
    origin: [patientUrl, hospitalUrl, adminUrl].filter(Boolean) as string[],
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  });

  // 5. Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // 6. Global Filters and Interceptors
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  // 7. Configure Swagger (OpenAPI)
  const config = new DocumentBuilder()
    .setTitle('Smart Hospital Shared Backend')
    .setDescription('Unified API platform serving the Patient, Hospital, and Admin Portals')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // 8. Start server
  const port = configService.get<number>('port') || 3000;
  await app.listen(port);
  console.log(`Smart Hospital Backend is running on: http://localhost:${port}/api/v1`);
  console.log(`Swagger documentation is available at: http://localhost:${port}/api/docs`);
}
bootstrap();
