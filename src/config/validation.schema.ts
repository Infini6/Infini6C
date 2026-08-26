import { IsEnum, IsNumber, IsOptional, IsString, validateSync } from 'class-validator';
import { plainToInstance } from 'class-transformer';

export enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

class EnvironmentVariables {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

  @IsNumber()
  @IsOptional()
  PORT: number = 3000;

  @IsString()
  DATABASE_URL: string;

  @IsString()
  @IsOptional()
  REDIS_URL: string = 'redis://localhost:6379';

  @IsString()
  @IsOptional()
  JWT_ACCESS_SECRET: string = 'supersecretaccesskey_smart_hospital_access_2026';

  @IsString()
  @IsOptional()
  JWT_REFRESH_SECRET: string = 'supersecretrefreshkey_smart_hospital_refresh_2026';

  @IsString()
  @IsOptional()
  PATIENT_FRONTEND_URL: string = 'http://localhost:4000';

  @IsString()
  @IsOptional()
  HOSPITAL_FRONTEND_URL: string = 'http://localhost:5000';

  @IsString()
  @IsOptional()
  ADMIN_FRONTEND_URL: string = 'http://localhost:6000';
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, { skipMissingProperties: false });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }
  return validatedConfig;
}
