import amqp from 'amqplib';

export interface AmqpConfig {
  host: string;
  port: number;
  user: string;
  password: string;
}

export type AmqpConnection = Awaited<ReturnType<typeof amqp.connect>>;
export type AmqpChannel = Awaited<ReturnType<AmqpConnection['createChannel']>>;

function buildUrl(config: AmqpConfig): string {
  return `amqp://${config.user}:${config.password}@${config.host}:${config.port}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function connectWithRetry(
  config: AmqpConfig,
  maxAttempts = 10,
  delayMs = 1000,
): Promise<AmqpConnection> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await amqp.connect(buildUrl(config));
    } catch (err) {
      lastErr = err;
      if (attempt < maxAttempts) await sleep(delayMs);
    }
  }
  throw lastErr;
}

export async function publishJson(
  channel: AmqpChannel,
  queueName: string,
  payload: unknown,
): Promise<void> {
  await channel.assertQueue(queueName, { durable: true });
  channel.sendToQueue(queueName, Buffer.from(JSON.stringify(payload)), { persistent: true });
}

export async function consumeJson<T>(
  channel: AmqpChannel,
  queueName: string,
  handler: (payload: T) => Promise<void>,
): Promise<void> {
  await channel.assertQueue(queueName, { durable: true });
  await channel.prefetch(1);
  await channel.consume(queueName, (msg) => {
    if (!msg) return;
    handler(JSON.parse(msg.content.toString()) as T)
      .then(() => channel.ack(msg))
      .catch(() => channel.nack(msg, false, false));
  });
}
