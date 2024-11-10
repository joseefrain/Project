import dotenv from 'dotenv';
const Redis = require('ioredis');

dotenv.config();

const redis = new Redis({
  sentinels: [
    { host: process.env.SENTINEL1_PRIVATE_DOMAIN, port: 26379 },
    { host: process.env.SENTINEL2_PRIVATE_DOMAIN, port: 26379 },
    { host: process.env.SENTINEL3_PRIVATE_DOMAIN, port: 26379 },
  ],
  name: process.env.REDIS_PRIMARY_NAME,
  family: 0,
  sentinelPassword: process.env.REDIS_PRIMARY_PASSWORD,
  sentinelUsername: "default",
  password: process.env.REDIS_PRIMARY_PASSWORD,
  username: "default"
});

redis.on('connect', () => {
  console.log('Conectado a Redis');
});

redis.on('error', (err) => {
  console.error('Error de conexión a Redis:', err);
});