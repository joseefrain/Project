import dotenv from 'dotenv';
const Redis = require('ioredis');

dotenv.config();

const redis = new Redis(process.env.REDIS_URL);

redis.on('connect', () => {
  console.log('Conectado a Redis');
});

redis.on('error', (err) => {
  console.error('Error de conexión a Redis:', err);
});