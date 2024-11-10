import dotenv from 'dotenv';
const Redis = require('ioredis');

dotenv.config();

const redis = new Redis({
  host: process.env.REDISHOST,
  port: process.env.REDISPORT,
  password: process.env.REDISPASSWORD,
  maxRetriesPerRequest: 5, // Número de reintentos
  connectTimeout: 30000,    // Tiempo de espera de conexión en ms
  retryStrategy(times) {
    // Define el tiempo de reintento exponencial
    return Math.min(times * 50, 2000);
  },
});

redis.on('connect', () => {
  console.log('Conectado a Redis');
});

redis.on('error', (err) => {
  console.error('Error de conexión a Redis:', err);
});