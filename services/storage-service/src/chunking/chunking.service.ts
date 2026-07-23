import { createHash } from 'node:crypto';

export interface ChunkPiece {
  index: number;
  data: Buffer;
  sizeBytes: number;
  checksum: string;
}

export function sha256(data: Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

export function splitIntoChunks(buffer: Buffer, chunkSizeBytes: number): ChunkPiece[] {
  const pieces: ChunkPiece[] = [];
  let index = 0;

  for (let offset = 0; offset < buffer.length; offset += chunkSizeBytes) {
    const data = buffer.subarray(offset, offset + chunkSizeBytes);
    pieces.push({ index, data, sizeBytes: data.length, checksum: sha256(data) });
    index += 1;
  }

  return pieces;
}
