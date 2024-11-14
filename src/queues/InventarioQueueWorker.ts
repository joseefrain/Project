import 'reflect-metadata';
import { VentaService } from "../services/venta/venta.service";
import { redisConfig } from "../config/redis";
import { Queue } from "./lib/queue";
import { container } from "tsyringe";

const inventarioQueueWorker  = new Queue('actualizacionInventario', process.env.MODE === "DEVELOPMENT" ? redisConfig : process.env.REDIS_URL as string);

// Definir el proceso para los trabajos
inventarioQueueWorker.process(async (job) => {
  console.log("Procesando actualización de inventario...");

  const salesService = container.resolve(VentaService);
  const result = await salesService.createVenta(job.data as any); // Retornar el resultado de la venta
  return result;
});

console.log("Worker inicializado y listo para procesar trabajos...");

inventarioQueueWorker.on('waiting', (job) => console.log(`Job ${job.id} is waiting.`));
inventarioQueueWorker.on('active', (job) => console.log(`Job ${job.id} is active.`));
inventarioQueueWorker.on('completed', (job) => console.log(`Job ${job.id} completed successfully.`));
inventarioQueueWorker.on('failed', (job) => console.log(`Job ${job.id} failed.`));