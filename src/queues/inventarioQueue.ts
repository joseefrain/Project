import { redisConfig } from "../config/redis";
import { Queue } from "./lib/queue";

const inventarioQueue  = new Queue('actualizacionInventario', process.env.MODE === "DEVELOPMENT" ? redisConfig : process.env.REDIS_URL as string);

export { inventarioQueue };