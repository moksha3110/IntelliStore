import { describe, expect, it } from 'vitest';
import { sha256, splitIntoChunks } from './chunking.service';

describe('splitIntoChunks', () => {
  it('splits a buffer into evenly sized chunks when it divides exactly', () => {
    const buffer = Buffer.alloc(3000, 'a');
    const pieces = splitIntoChunks(buffer, 1000);

    expect(pieces).toHaveLength(3);
    expect(pieces.map((p) => p.sizeBytes)).toEqual([1000, 1000, 1000]);
    expect(pieces.map((p) => p.index)).toEqual([0, 1, 2]);
  });

  it('produces a smaller final chunk for a remainder', () => {
    const buffer = Buffer.alloc(2500, 'b');
    const pieces = splitIntoChunks(buffer, 1000);

    expect(pieces.map((p) => p.sizeBytes)).toEqual([1000, 1000, 500]);
  });

  it('returns a single chunk when the buffer is smaller than the chunk size', () => {
    const buffer = Buffer.from('hello world');
    const pieces = splitIntoChunks(buffer, 1000);

    expect(pieces).toHaveLength(1);
    expect(pieces[0].sizeBytes).toBe(buffer.length);
  });

  it('returns no chunks for an empty buffer', () => {
    expect(splitIntoChunks(Buffer.alloc(0), 1000)).toHaveLength(0);
  });

  it('computes a deterministic checksum per chunk', () => {
    const buffer = Buffer.from('deterministic content');
    const [first] = splitIntoChunks(buffer, 1000);
    const [second] = splitIntoChunks(Buffer.from('deterministic content'), 1000);

    expect(first.checksum).toBe(second.checksum);
  });

  it('produces different checksums for different content', () => {
    const [a] = splitIntoChunks(Buffer.from('content A'), 1000);
    const [b] = splitIntoChunks(Buffer.from('content B'), 1000);

    expect(a.checksum).not.toBe(b.checksum);
  });
});

describe('sha256', () => {
  it('is stable for identical input', () => {
    const data = Buffer.from('same bytes');
    expect(sha256(data)).toBe(sha256(Buffer.from('same bytes')));
  });
});
