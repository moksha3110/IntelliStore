import { pool } from './db/pool';
import { PgFileRepository } from './repositories/file.repository';
import { FileService } from './services/file.service';

export const fileRepository = new PgFileRepository(pool);

export const fileService = new FileService(fileRepository);
