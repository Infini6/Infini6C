import { Controller, Post, Body, Res, Req, UseGuards, HttpStatus, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import * as express from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new patient' })
  @ApiResponse({ status: 201, description: 'Patient registered successfully' })
  async register(@Body() dto: RegisterDto) {
    const result = await this.authService.register(dto);
    return {
      success: true,
      message: 'Patient registered successfully',
      data: result,
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log in with credentials' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: express.Request,
    @Res({ passthrough: true }) res: express.Response,
  ) {
    const ipAddress = req.ip || req.socket.remoteAddress;
    const deviceFingerprint = req.headers['user-agent'];

    const result = await this.authService.login(dto, deviceFingerprint, ipAddress);

    res.cookie('refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/v1/auth',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return {
      success: true,
      message: 'Logged in successfully',
      data: {
        accessToken: result.accessToken,
        user: result.user,
      },
    };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  async refresh(
    @Req() req: express.Request,
    @Res({ passthrough: true }) res: express.Response,
    @Body('refreshToken') bodyRefreshToken?: string,
  ) {
    const cookies = req.cookies || {};
    const refreshToken = cookies['refresh_token'] || bodyRefreshToken;

    if (!refreshToken) {
      res.status(HttpStatus.UNAUTHORIZED);
      return {
        success: false,
        error: {
          code: 'REFRESH_TOKEN_MISSING',
          message: 'Refresh token is missing from cookies and request body',
        },
      };
    }

    const ipAddress = req.ip || req.socket.remoteAddress;
    const deviceFingerprint = req.headers['user-agent'];

    try {
      const result = await this.authService.refresh(refreshToken, deviceFingerprint, ipAddress);

      res.cookie('refresh_token', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/api/v1/auth',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      return {
        success: true,
        data: {
          accessToken: result.accessToken,
        },
      };
    } catch (err: any) {
      res.status(HttpStatus.UNAUTHORIZED);
      return {
        success: false,
        error: {
          code: 'INVALID_REFRESH_TOKEN',
          message: err.message || 'Invalid or expired refresh token',
        },
      };
    }
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log out user session' })
  async logout(
    @Req() req: express.Request,
    @Res({ passthrough: true }) res: express.Response,
    @Body('refreshToken') bodyRefreshToken?: string,
  ) {
    const cookies = req.cookies || {};
    const refreshToken = cookies['refresh_token'] || bodyRefreshToken;

    if (refreshToken) {
      try {
        await this.authService.logout(refreshToken);
      } catch (err) {}
    }

    res.clearCookie('refresh_token', {
      path: '/api/v1/auth',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });

    return {
      success: true,
      message: 'Logged out successfully',
    };
  }
}
