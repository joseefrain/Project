import Queue from 'bull';
import { redisConfig } from "../config/redis"; 
import { container } from 'tsyringe';
import { VentaService } from '../services/venta/venta.service';

const inventarioQueue = new Queue('actualizacionInventario', {
  redis: redisConfig,
});

inventarioQueue.process(async (job) => {
  const salesService = container.resolve(VentaService);
  await salesService.createVenta(job.data);
});

export { inventarioQueue };
