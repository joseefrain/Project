import Queue from 'bull';
import { container } from 'tsyringe';
import { VentaService } from '../services/venta/venta.service';
import dotenv from 'dotenv';
const Redis = require('ioredis');

dotenv.config();

// Crear la instancia de Redis
const redis = new Redis(process.env.REDIS_URL);

// Configurar la cola de Bull con la instancia de Redis
const inventarioQueue = new Queue('actualizacionInventario', {
  redis: redis,
});

// Verificar la conexión de Redis directamente con el evento "ready" de la cola
inventarioQueue.on('ready', () => {
  console.log('La cola está lista y conectada a Redis');
});

// Verificar cualquier error de la cola
inventarioQueue.on('error', (err) => {
  console.error('Error en la cola de Bull:', err);
});

inventarioQueue.on('failed', (job, err) => {
  console.error('Error en el trabajo de la cola:', err);
});

// Opcional: Verificar el estado de la conexión de Redis
redis.on('connect', () => {
  console.log('Conectado a Redis');
});

redis.on('error', (err) => {
  console.error('Error de conexión a Redis:', err);
});

// Procesar los trabajos de la cola
inventarioQueue.process(async (job) => {
  const salesService = container.resolve(VentaService);
  await salesService.createVenta(job.data);
});

export { inventarioQueue };
