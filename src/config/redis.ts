import { RedisOptions } from 'bullmq';
import dotenv from 'dotenv';

dotenv.config();

export const redisConfig: RedisOptions = {
  host: process.env.REDISHOST || 'localhost',
  port: Number(process.env.REDISPORT) || 6379,
  password: process.env.REDISPASSWORD || '',
  url: process.env.REDIS_URL || '',
  username: process.env.REDISUSER || '',
}