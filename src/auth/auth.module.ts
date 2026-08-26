import { Module, Global } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { UsersModule } from '../users/users.module.js';
import { PatientsModule } from '../patients/patients.module.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';

@Global()
@Module({
  imports: [
    UsersModule,
    PatientsModule,
    JwtModule.register({}),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard],
  exports: [AuthService, JwtModule, JwtAuthGuard],
})
export class AuthModule {}
