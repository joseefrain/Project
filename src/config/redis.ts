import { RedisOptions } from 'bullmq';
import dotenv from 'dotenv';

dotenv.config();

export const redisConfig: RedisOptions = {
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || '',
  url: process.env.REDIS_URL || '',
}