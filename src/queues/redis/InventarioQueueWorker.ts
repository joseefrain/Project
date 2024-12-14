
import 'reflect-metadata';
import { TransactionService } from "../../services/venta/venta.service";
import { redisConfig } from "../../config/redis";
import { Queue } from "./module/queue";
import { container } from "tsyringe";
import connectDB from '../../config/database';

connectDB();

const inventarioQueueWorker  = new Queue('actualizacionInventario', process.env.MODE === "DEVELOPMENT" ? redisConfig : process.env.REDIS_URL as string);

// Definir el proceso para los trabajos
inventarioQueueWorker.process(async (job) => {
  console.log("Procesando actualización de inventario...");

  const salesService = container.resolve(TransactionService);
  const result = await salesService.createTransaction(job.data as any); // Retornar el resultado de la venta
  return result;
});


inventarioQueueWorker.on('waiting', (job) => console.log(`Job ${job.id} is waiting.`));
inventarioQueueWorker.on('active', (job) => console.log(`Job ${job.id} is active.`));
inventarioQueueWorker.on('completed', (job) => console.log(`Job ${job.id} completed successfully.`));
inventarioQueueWorker.on('failed', (job) => console.log(`Job ${job.id} failed.`));