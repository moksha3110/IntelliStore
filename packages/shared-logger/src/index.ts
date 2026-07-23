import pino from 'pino';

export interface LoggerOptions {
  serviceName: string;
  level?: string;
}

export function createLogger({ serviceName, level }: LoggerOptions): pino.Logger {
  const isProduction = process.env.NODE_ENV === 'production';

  return pino({
    name: serviceName,
    level: level ?? process.env.LOG_LEVEL ?? 'info',
    transport: isProduction
      ? undefined
      : {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        },
  });
}

export type Logger = pino.Logger;
