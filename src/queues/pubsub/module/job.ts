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
  backoff: number;
  createdAt: number;

  constructor(
    data: JobData,
    options: {
      maxAttempts?: number;
      delay?: number;
      backoff?: number;
    } = {}
  ) {
    this.id = uuidv4();
    this.data = data;
    this.status = 'waiting';
    this.attempts = 0;
    this.maxAttempts = options.maxAttempts || 3;
    this.delay = options.delay || 0;
    this.backoff = options.backoff || 5000; // Retraso por defecto (5s)
    this.createdAt = Date.now();
  }

  incrementAttempts() {
    this.attempts++;
  }
}
