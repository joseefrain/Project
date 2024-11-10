import { Queue } from "./lib/queue";

const inventarioQueue  = new Queue('actualizacionInventario', (process.env.REDIS_URL as string));

// Definir el proceso para los trabajos
inventarioQueue .process(async (job) => {
  console.log(`Processing job ${job.id} with data:`, job.data);
  await new Promise(resolve => setTimeout(resolve, 2000)); // Simulación de trabajo
});

export { inventarioQueue };