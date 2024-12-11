import { redisConfig } from "../../config/redis";
import { Queue } from "./module/queue";

const inventarioQueue  = new Queue('actualizacionInventario', process.env.MODE === "DEVELOPMENT" ? redisConfig : process.env.REDIS_URL as string);

export { inventarioQueue };