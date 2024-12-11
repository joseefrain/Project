import { EventEmitter } from 'events';
import { PubSub, Subscription, Topic } from '@google-cloud/pubsub';
import { Job } from './job';

type ProcessFunction<T = any> = (job: Job) => Promise<T>;

export class Queue<T = any> extends EventEmitter {
  private pubsub: PubSub;
  private topic: Topic;
  private subscription: Subscription;
  private queueName: string;
  private processFunction: ProcessFunction<T> | null = null;
  private isProcessing = false;
  private readonly inactivityTime: number = 30000; // Tiempo de inactividad en ms
  private inactivityTimeout: NodeJS.Timeout | null = null;

  constructor(queueName: string, pubsubOptions: any = {}) {
    super();
    this.queueName = queueName;
    this.pubsub = new PubSub(pubsubOptions);

    // Inicializa el topic y la subscription
    this.topic = this.pubsub.topic(`${queueName}-topic`);
    this.subscription = this.topic.subscription(`${queueName}-subscription`);

    // Crea los recursos si no existen
    this.initQueue();
  }

  private async initQueue() {
    const [topicExists] = await this.topic.exists();
    if (!topicExists) await this.topic.create();

    const [subscriptionExists] = await this.subscription.exists();
    if (!subscriptionExists) await this.subscription.create();

    // Escucha mensajes en la suscripción
    this.subscription.on('message', (message) => {
      const job: Job = JSON.parse(message.data.toString());
      this.emit(job.status, job);
      message.ack();
      this.resetInactivityTimer(); // Reinicia el temporizador de inactividad
    });

    this.resetInactivityTimer(); // Inicia el temporizador de inactividad
  }

  private resetInactivityTimer() {
    if (this.inactivityTimeout) clearTimeout(this.inactivityTimeout);

    this.inactivityTimeout = setTimeout(() => {
      this.stop();
    }, this.inactivityTime);
  }

  async add(
    data: any,
    options: { delay?: number; maxAttempts?: number; backoff?: number; ttl?: number } = {}
  ): Promise<T> {
    this.resetInactivityTimer();

    const job = new Job(data, options);

    // Si tiene un retraso, programar el trabajo
    if (job.delay > 0) {
      setTimeout(() => {
        this.publishJob(job);
      }, job.delay);
    } else {
      await this.publishJob(job);
    }

    return new Promise((resolve, reject) => {
      this.once(`completed:${job.id}`, (result: T) => resolve(result));
      this.once(`failed:${job.id}`, (error) => reject(error));
    });
  }

  private async publishJob(job: Job) {
    const messageId = await this.topic.publishMessage({
      json: job,
    });
    console.log(`Trabajo publicado con ID: ${messageId}`);
  }

  async process(processFunction: ProcessFunction<T>) {
    this.processFunction = processFunction;

    if (!this.isProcessing) {
      this.isProcessing = true;
      this.startProcessing();
    }
  }

  private async startProcessing() {
    this.resetInactivityTimer();

    this.subscription.on('message', async (message) => {
      const job: Job = JSON.parse(message.data.toString());

      try {
        this.emit('active', job);

        // Procesa el trabajo
        const result = await this.processFunction?.(job);
        job.status = 'completed';

        // Publica el resultado del trabajo
        this.emit(`completed:${job.id}`, result);
        this.emit('completed', job);
        message.ack();
      } catch (error) {
        job.incrementAttempts();
        if (job.attempts < job.maxAttempts) {
          console.log(`Reintentando trabajo ${job.id}`);
          await this.add(job.data, { delay: job.backoff });
        } else {
          job.status = 'failed';
          this.emit(`failed:${job.id}`, error);
          this.emit('failed', job);
          message.ack();
        }
      }

      this.resetInactivityTimer();
    });
  }

  stop() {
    console.log('Parando procesamiento por inactividad.');
    this.subscription.removeAllListeners('message');
    this.isProcessing = false;
  }
}
