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

// ---- Pub/sub over a topic exchange ----
//
// The plain queue helpers above give work-queue semantics: multiple consumers
// of one queue *compete* for messages (each message goes to exactly one). For
// domain events that several services must each react to independently
// (replication, analytics, notifications all care about an upload), that's
// wrong — we want fan-out. A topic exchange with a per-consumer queue gives
// every subscriber its own copy.

export async function publishEvent(
  channel: AmqpChannel,
  exchange: string,
  routingKey: string,
  payload: unknown,
): Promise<void> {
  await channel.assertExchange(exchange, 'topic', { durable: true });
  channel.publish(exchange, routingKey, Buffer.from(JSON.stringify(payload)), {
    persistent: true,
  });
}

/**
 * Subscribe to one or more routing keys on a topic exchange using a queue
 * private to this consumer. Each subscriber passes its own durable
 * `queueName`, so fan-out is preserved: every subscriber's queue receives its
 * own copy of a matching event.
 */
export async function subscribeEvent<T>(
  channel: AmqpChannel,
  exchange: string,
  queueName: string,
  routingKeys: string[],
  handler: (payload: T, routingKey: string) => Promise<void>,
): Promise<void> {
  await channel.assertExchange(exchange, 'topic', { durable: true });
  await channel.assertQueue(queueName, { durable: true });
  for (const key of routingKeys) {
    await channel.bindQueue(queueName, exchange, key);
  }
  await channel.prefetch(1);
  await channel.consume(queueName, (msg) => {
    if (!msg) return;
    handler(JSON.parse(msg.content.toString()) as T, msg.fields.routingKey)
      .then(() => channel.ack(msg))
      .catch(() => channel.nack(msg, false, false));
  });
}
