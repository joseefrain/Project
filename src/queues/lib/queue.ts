// src/queue.ts
import { EventEmitter } from 'events';
import { Job } from './job';
import { RedisOptions, Redis } from 'ioredis';

type ProcessFunction = (job: Job) => Promise<void>;

export class Queue extends EventEmitter {
  private redis: Redis;
  private queueName: string;
  private processFunction: ProcessFunction | null = null;
  private isProcessing = false;

  constructor(queueName: string, redisConfig: RedisOptions | string) {
    super();
    this.queueName = queueName;
    this.redis = new Redis(redisConfig as string);
  }

  // Define el proceso para los trabajos de esta cola
  process(processFunction: ProcessFunction) {
    this.processFunction = processFunction;
    if (!this.isProcessing) {
      this.startProcessing();
    }
  }

  // Agregar un trabajo a la cola
  async add(data: any, options: { delay?: number; maxAttempts?: number; backoff?: number; ttl?: number } = {}) {
    const job = new Job(data, options);
    if (job.delay > 0) {
      await this.scheduleDelayedJob(job);
    } else {
      await this.redis.rpush(`${this.queueName}:waiting`, JSON.stringify(job));
    }
    this.emit('waiting', job);
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
        await new Promise(resolve => setTimeout(resolve, 1000)); // Espera de 1 segundo si no hay trabajos
      }
      await this.processDelayedJobs();
    }
  }

  // Procesar cada trabajo con gestión de estado y reintentos
  private async handleJob(job: Job) {
    if (job.isExpired()) {
      this.emit('failed', job);
      return;
    }

    try {
      job.incrementAttempts();
      this.emit('active', job);

      await this.processFunction?.(job);
      job.status = 'completed';
      this.emit('completed', job);
    } catch (error) {
      if (job.attempts < job.maxAttempts) {
        await this.scheduleDelayedJob(job, job.backoff);
      } else {
        job.status = 'failed';
        this.emit('failed', job);
      }
    }
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
