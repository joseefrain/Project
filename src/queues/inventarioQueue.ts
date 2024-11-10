import Queue from 'bull';
import { redisConfig } from "../config/redis"; 
import { container } from 'tsyringe';
import { VentaService } from '../services/venta/venta.service';

import dotenv from 'dotenv';
const Redis = require('ioredis');

dotenv.config();

const redis = new Redis(process.env.REDIS_URL);

redis.on('connect', () => {
  console.log('Conectado a Redis');
});

redis.on('error', (err) => {
  console.error('Error de conexión a Redis:', err);
});

const inventarioQueue = new Queue('actualizacionInventario', {
  redis: redis,
});

inventarioQueue.process(async (job) => {
  const salesService = container.resolve(VentaService);
  await salesService.createVenta(job.data);
});

export { inventarioQueue };
