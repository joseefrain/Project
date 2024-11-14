// src/queue.ts
import { EventEmitter } from 'events';
import { Job } from './job';
import { RedisOptions, Redis } from 'ioredis';

type ProcessFunction<T = any> = (job: Job) => Promise<T>;

export class Queue<T = any> extends EventEmitter {
  private redis: Redis;
  private subscriber: Redis;  // Añade un suscriptor de Redis para Pub/Sub
  private queueName: string;
  private processFunction: ProcessFunction<T> | null = null;
  private isProcessing = false;

  constructor(queueName: string, redisConfig: RedisOptions | string) {
    super();
    this.queueName = queueName;
    this.redis = new Redis(redisConfig as string);
    this.subscriber = new Redis(redisConfig as string); // Inicializa el suscriptor

    // Configura el listener para el canal de Pub/Sub
    this.subscriber.subscribe(`${this.queueName}:events`);
    this.subscriber.on('message', (channel, message) => {
      const event = JSON.parse(message);
      this.emit(event.type, event.job);
    });
  }

  // Define el proceso para los trabajos de esta cola
  async process(processFunction: ProcessFunction<T>) {
    this.processFunction = processFunction;
    if (!this.isProcessing) {
      await this.startProcessing();
    }
  }

  // Agregar un trabajo a la cola
  async add(data: any, options: { delay?: number; maxAttempts?: number; backoff?: number; ttl?: number } = {}): Promise<T> {
    const job = new Job(data, options);
    await this.redis.rpush(`${this.queueName}:waiting`, JSON.stringify(job));
    this.publishEvent('waiting', job);

    return new Promise((resolve, reject) => {
      // Resolver la promesa cuando el trabajo se complete
      this.once(`completed:${job.id}`, (result: T) => resolve(result));
      this.once(`failed:${job.id}`, (error) => reject(error));
    });
  }

  // Ejecuta trabajos de la cola
  private async startProcessing() {
    this.isProcessing = true;
    while (this.isProcessing) {
      const jobData = await this.redis.lpop(`${this.queueName}:waiting`);
      if (jobData) {
        const job: Job = Object.assign(new Job({}), JSON.parse(jobData));
        await this.handleJob(job);
      } else {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      await this.processDelayedJobs();
    }
  }

  private async handleJob(job: Job) {
    if (job.isExpired()) {
      this.publishEvent('failed', job);
      return;
    }

    try {
      job.incrementAttempts();
      this.emit('active', job);

      const result = await this.processFunction?.(job);
      job.status = 'completed';
      this.publishEvent('completed', job);
      this.publishEvent(`completed:${job.id}`, result);
      this.emit('completed', job);
    } catch (error) {
      if (job.attempts < job.maxAttempts) {
        await this.scheduleDelayedJob(job, job.backoff);
      } else {
        job.status = 'failed';
        this.publishEvent('failed', job);
        this.publishEvent(`failed:${job.id}`, job);
        this.emit('failed', job);
      }
    }
  }

  private async publishEvent(type: string, job: any) {
    await this.redis.publish(`${this.queueName}:events`, JSON.stringify({ type, job }));
  }


  // Agrega trabajos con retraso al zset de retrasos
  private async scheduleDelayedJob(job: Job, customDelay?: number) {
    const delay = customDelay || job.delay;
    await this.redis.zadd(`${this.queueName}:delayed`, Date.now() + delay, JSON.stringify(job));
  }

  // Procesa trabajos retrasados que ya cumplieron su tiempo de espera
  private async processDelayedJobs() {
    const jobs = await this.redis.zrangebyscore(`${this.queueName}:delayed`, 0, Date.now());
    for (const jobData of jobs) {
      const job: Job = JSON.parse(jobData);
      await this.redis.rpush(`${this.queueName}:waiting`, JSON.stringify(job));
      await this.redis.zrem(`${this.queueName}:delayed`, jobData);
    }
  }

  // Detiene el procesamiento
  stop() {
    this.isProcessing = false;
  }
}
