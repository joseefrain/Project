// src/job.ts
import { v4 as uuidv4 } from 'uuid';

export type JobStatus = 'waiting' | 'active' | 'completed' | 'failed';

export interface JobData {
  [key: string]: any;
}

export class Job {
  id: string;
  data: JobData;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  delay: number;
  priority: number;
  backoff: number;
  ttl: number;
  createdAt: number;
  updatedAt: number;

  constructor(
    data: JobData,
    options: {
      maxAttempts?: number;
      delay?: number;
      priority?: number;
      backoff?: number;
      ttl?: number;
    } = {}
  ) {
    this.id = uuidv4();
    this.data = data;
    this.status = 'waiting';
    this.attempts = 0;
    this.maxAttempts = options.maxAttempts || 3;
    this.delay = options.delay || 0;
    this.priority = options.priority || 1;
    this.backoff = options.backoff || 5000;
    this.ttl = options.ttl || 300000; // 5 minutos por defecto
    this.createdAt = Date.now();
    this.updatedAt = this.createdAt;
  }

  incrementAttempts() {
    this.attempts++;
    this.updatedAt = Date.now();
  }

  isExpired(): boolean {
    return this.ttl > 0 && Date.now() - this.createdAt > this.ttl;
  }
}
