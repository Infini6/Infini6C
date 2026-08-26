import { Controller, Get, Res, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service.js';
import { RedisService } from '../redis/redis.service.js';
import * as express from 'express';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Check overall system health' })
  @ApiResponse({ status: 200, description: 'System is healthy' })
  @ApiResponse({ status: 500, description: 'System is unhealthy' })
  async checkAll(@Res() res: express.Response) {
    let dbHealthy = false;
    let redisHealthy = false;
    

    try {
      await this.prisma.user.findFirst();
      dbHealthy = true;
    } catch (err) {}

    try {
      const ping = await this.redis.ping();
      redisHealthy = ping === 'PONG';
    } catch (err) {}

    const statusCode = dbHealthy && redisHealthy ? HttpStatus.OK : HttpStatus.INTERNAL_SERVER_ERROR;

    return res.status(statusCode).json({
      status: dbHealthy && redisHealthy ? 'healthy' : 'unhealthy',
      details: {
        database: dbHealthy ? 'up' : 'down',
        redis: redisHealthy ? 'up' : 'down',
      },
    });
  }

  @Get('database')
  @ApiOperation({ summary: 'Check database health' })
  async checkDatabase(@Res() res: express.Response) {
    try {
      await this.prisma.user.findFirst();
      return res.status(HttpStatus.OK).json({ status: 'up' });
    } catch (err: any) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        status: 'down',
        error: err.message,
      });
    }
  }

  @Get('redis')
  @ApiOperation({ summary: 'Check Redis health' })
  async checkRedis(@Res() res: express.Response) {
    try {
      const ping = await this.redis.ping();
      if (ping === 'PONG') {
        return res.status(HttpStatus.OK).json({ status: 'up' });
      }
      throw new Error('Invalid ping response');
    } catch (err: any) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        status: 'down',
        error: err.message,
      });
    }
  }
}
