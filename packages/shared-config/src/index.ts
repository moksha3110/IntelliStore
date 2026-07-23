import { config as loadDotenv } from 'dotenv';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { z } from 'zod';

function findRepoRootEnvPath(): string | undefined {
  let dir = process.cwd();
  for (let i = 0; i < 6; i += 1) {
    const candidate = join(dir, '.env');
    if (existsSync(join(dir, 'docker-compose.yml')) && existsSync(candidate)) {
      return candidate;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return undefined;
}

loadDotenv({ path: findRepoRootEnvPath() });

const baseEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.string().default('info'),

  POSTGRES_HOST: z.string().default('localhost'),
  POSTGRES_PORT: z.coerce.number().default(5432),
  POSTGRES_USER: z.string().default('intellistore'),
  POSTGRES_PASSWORD: z.string().default('intellistore_dev_password'),
  POSTGRES_DB: z.string().default('intellistore'),

  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),

  RABBITMQ_HOST: z.string().default('localhost'),
  RABBITMQ_PORT: z.coerce.number().default(5672),
  RABBITMQ_USER: z.string().default('intellistore'),
  RABBITMQ_PASSWORD: z.string().default('intellistore_dev_password'),

  MINIO_ENDPOINT: z.string().default('localhost'),
  MINIO_PORT: z.coerce.number().default(9000),
  MINIO_ROOT_USER: z.string().default('intellistore'),
  MINIO_ROOT_PASSWORD: z.string().default('intellistore_dev_password'),
  MINIO_BUCKET: z.string().default('intellistore-chunks'),

  JWT_SECRET: z.string().default('change-me-in-production'),
  JWT_REFRESH_SECRET: z.string().default('change-me-refresh-in-production'),
  JWT_EXPIRES_IN: z.string().default('1h'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
});

export type BaseEnv = z.infer<typeof baseEnvSchema>;

let cachedEnv: BaseEnv | undefined;

export function getBaseEnv(): BaseEnv {
  if (!cachedEnv) {
    cachedEnv = baseEnvSchema.parse(process.env);
  }
  return cachedEnv;
}

export function loadServicePort(envVarName: string, fallback: number): number {
  const raw = process.env[envVarName];
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (Number.isNaN(parsed)) {
    throw new Error(`Environment variable ${envVarName} must be a number, got "${raw}"`);
  }
  return parsed;
}
