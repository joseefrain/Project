// src/queue.ts
import { EventEmitter } from 'events';
import { Job } from './job';
import { RedisOptions, Redis } from 'ioredis';

type ProcessFunction<T = any> = (job: Job) => Promise<T>;

export class Queue<T = any> extends EventEmitter {
  private redis: Redis;
  private queueName: string;
  private processFunction: ProcessFunction<T> | null = null;
  private isProcessing = false;

  constructor(queueName: string, redisConfig: RedisOptions | string) {
    super();
    this.queueName = queueName;
    this.redis = new Redis(redisConfig as string);
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

    if (job.delay > 0) {
      await this.scheduleDelayedJob(job);
    } else {
      await this.redis.rpush(`${this.queueName}:waiting`, JSON.stringify(job));
    }
    this.emit('waiting', job);

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
        await new Promise(resolve => setTimeout(resolve, 1000)); // Espera de 1 segundo si no hay trabajos
      }
      await this.processDelayedJobs();
    }
  }

  // Procesar cada trabajo con gestión de estado y reintentos
  private async handleJob(job: Job) {
    if (job.isExpired()) {
      this.emit(`failed:${job.id}`, new Error('Job expired'));
      return;
    }

    try {
      job.incrementAttempts();
      this.emit('active', job);

      // Procesa el trabajo y emite el resultado en caso de éxito
      const result = await this.processFunction?.(job);
      job.status = 'completed';
      this.emit(`completed:${job.id}`, result); // Emitir el resultado de forma genérica
      this.emit('completed', job);
    } catch (error) {
      if (job.attempts < job.maxAttempts) {
        await this.scheduleDelayedJob(job, job.backoff);
      } else {
        job.status = 'failed';
        this.emit(`failed:${job.id}`, error);
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
