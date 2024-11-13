import { VentaService } from "../services/venta/venta.service";
import { redisConfig } from "../config/redis";
import { Queue } from "./lib/queue";
import { container } from "tsyringe";

const inventarioQueue  = new Queue('actualizacionInventario', process.env.MODE === "DEVELOPMENT" ? redisConfig : process.env.REDIS_URL as string);

// Definir el proceso para los trabajos
inventarioQueue.process(async (job) => {
  console.log("proceso de inventario");
  
  const salesService = container.resolve(VentaService);
  await salesService.createVenta(job.data as any);
  // console.log(`Processing job ${job.id} with data:`, job.data);
  // await new Promise(resolve => setTimeout(resolve, 2000)); // Simulación de trabajo
});

export { inventarioQueue };