import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client!: Redis;
  private readonly logger = new Logger(RedisService.name);

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const redisUrl = this.configService.get<string>('redis.url') || 'redis://localhost:6379';
    this.client = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
    });

    this.client.on('connect', () => {
      this.logger.log('Connected to Redis');
    });

    this.client.on('error', (err) => {
      this.logger.error('Redis error', err);
    });
  }

  onModuleDestroy() {
    this.client.disconnect();
  }

  getClient(): Redis {
    return this.client;
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<string> {
    if (ttlSeconds) {
      return this.client.set(key, value, 'EX', ttlSeconds);
    }
    return this.client.set(key, value);
  }

  async del(key: string): Promise<number> {
    return this.client.del(key);
  }

  async ping(): Promise<string> {
    return this.client.ping();
  }

  async acquireLock(lockKey: string, ttlMs: number): Promise<boolean> {
    // NX: Only set if key doesn't exist. PX: Expire in ms.
    const result = await (this.client as any).set(lockKey, 'locked', 'PX', ttlMs, 'NX');
    return result === 'OK';
  }

  async releaseLock(lockKey: string): Promise<void> {
    await this.client.del(lockKey);
  }
}
