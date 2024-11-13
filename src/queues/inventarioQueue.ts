import { VentaService } from "../services/venta/venta.service";
import { redisConfig } from "../config/redis";
import { Queue } from "./lib/queue";
import { container } from "tsyringe";

const inventarioQueue  = new Queue('actualizacionInventario', process.env.MODE === "DEVELOPMENT" ? redisConfig : process.env.REDIS_URL as string);

// Definir el proceso para los trabajos
inventarioQueue.process(async (job) => {
  console.log("Procesando actualización de inventario...");

  const salesService = container.resolve(VentaService);
  const result = await salesService.createVenta(job.data as any); // Retornar el resultado de la venta
  return result;
});

export { inventarioQueue };