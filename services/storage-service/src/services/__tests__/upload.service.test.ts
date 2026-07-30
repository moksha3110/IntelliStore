import { beforeEach, describe, expect, it } from 'vitest';
import { UploadService } from '../upload.service';
import { FakeEventPublisher } from './fake-event-publisher';
import { FakeMetadataClient } from './fake-metadata-client';
import { InMemoryStorageBackend } from './in-memory-storage-backend';

function makeFileRegisterResult() {
  return {
    file: {
      id: 'file-1',
      ownerId: 'owner-1',
      fileName: 'report.pdf',
      isDeleted: false,
      createdAt: 'now',
      updatedAt: 'now',
    },
    version: {
      id: 'version-1',
      fileId: 'file-1',
      versionNumber: 1,
      sizeBytes: 2500,
      mimeType: 'application/pdf',
      checksum: 'file-checksum',
      createdAt: 'now',
    },
    chunks: [
      {
        id: 'chunk-1',
        fileVersionId: 'version-1',
        chunkIndex: 0,
        sizeBytes: 1000,
        checksum: 'c0',
        storageKey: 'session/0',
      },
      {
        id: 'chunk-2',
        fileVersionId: 'version-1',
        chunkIndex: 1,
        sizeBytes: 1000,
        checksum: 'c1',
        storageKey: 'session/1',
      },
      {
        id: 'chunk-3',
        fileVersionId: 'version-1',
        chunkIndex: 2,
        sizeBytes: 500,
        checksum: 'c2',
        storageKey: 'session/2',
      },
    ],
  };
}

describe('UploadService', () => {
  let backend: InMemoryStorageBackend;
  let metadataClient: FakeMetadataClient;
  let eventPublisher: FakeEventPublisher;
  let uploadService: UploadService;

  beforeEach(() => {
    backend = new InMemoryStorageBackend();
    metadataClient = new FakeMetadataClient();
    eventPublisher = new FakeEventPublisher();
    uploadService = new UploadService(backend, metadataClient, eventPublisher, {
      chunkSizeBytes: 1000,
    });
  });

  // Three chunks of *distinct* content, so each is stored separately (no
  // intra-file dedup) — exercises the plain chunk+store+register path.
  const distinctBuffer = Buffer.concat([
    Buffer.alloc(1000, 'a'),
    Buffer.alloc(1000, 'b'),
    Buffer.alloc(500, 'c'),
  ]);

  it('stores each chunk in the backend and registers the file with matching metadata', async () => {
    metadataClient.registerFileResult = makeFileRegisterResult();

    await uploadService.uploadNewFile('token-123', 'report.pdf', 'application/pdf', distinctBuffer);

    expect(backend.store.size).toBe(3);
    expect(metadataClient.registerFileCalls).toHaveLength(1);

    const call = metadataClient.registerFileCalls[0];
    expect(call.bearerToken).toBe('token-123');
    expect(call.payload.fileName).toBe('report.pdf');
    expect(call.payload.chunks).toHaveLength(3);
    expect(call.payload.chunks.map((c) => c.sizeBytes)).toEqual([1000, 1000, 500]);
    // Content-addressed keys.
    expect(call.payload.chunks.every((c) => c.storageKey === `chunks/${c.checksum}`)).toBe(true);

    for (const chunk of call.payload.chunks) {
      expect(backend.store.has(chunk.storageKey)).toBe(true);
    }
  });

  it('deduplicates identical chunk content across uploads (content-addressed storage)', async () => {
    metadataClient.registerFileResult = makeFileRegisterResult();

    const first = await uploadService.uploadNewFile('t', 'a.bin', 'application/octet-stream', distinctBuffer);
    expect(first.dedup).toEqual({ totalChunks: 3, storedChunks: 3, dedupedChunks: 0, bytesSaved: 0 });
    const objectsAfterFirst = backend.store.size;
    expect(objectsAfterFirst).toBe(3);

    // Same content, different file name — every chunk should dedup.
    const second = await uploadService.uploadNewFile('t', 'b.bin', 'application/octet-stream', distinctBuffer);
    expect(second.dedup).toEqual({
      totalChunks: 3,
      storedChunks: 0,
      dedupedChunks: 3,
      bytesSaved: 2500,
    });
    // No new objects were written — stored exactly once.
    expect(backend.store.size).toBe(objectsAfterFirst);
  });

  it('deduplicates repeated content within a single file', async () => {
    metadataClient.registerFileResult = makeFileRegisterResult();
    // 2500 identical bytes -> chunks [1000,1000,500]; the two 1000-byte chunks
    // are identical content and collapse to one stored object.
    const result = await uploadService.uploadNewFile('t', 'x.bin', 'text/plain', Buffer.alloc(2500, 'x'));

    expect(result.dedup.totalChunks).toBe(3);
    expect(result.dedup.dedupedChunks).toBe(1);
    expect(backend.store.size).toBe(2);
  });

  it('publishes a chunk-uploaded event after successful registration', async () => {
    metadataClient.registerFileResult = makeFileRegisterResult();
    await uploadService.uploadNewFile(
      'token-123',
      'report.pdf',
      'application/pdf',
      Buffer.alloc(2500, 'x'),
    );

    expect(eventPublisher.publishedEvents).toHaveLength(1);
    const event = eventPublisher.publishedEvents[0];
    expect(event.fileId).toBe('file-1');
    expect(event.ownerId).toBe('owner-1');
    expect(event.fileName).toBe('report.pdf');
    expect(event.versionId).toBe('version-1');
    expect(event.versionNumber).toBe(1);
    expect(event.chunks).toEqual([
      { chunkId: 'chunk-1', storageKey: 'session/0', sizeBytes: 1000 },
      { chunkId: 'chunk-2', storageKey: 'session/1', sizeBytes: 1000 },
      { chunkId: 'chunk-3', storageKey: 'session/2', sizeBytes: 500 },
    ]);
  });

  it('does not publish an event when registration fails', async () => {
    metadataClient.registerFileError = new Error('metadata service rejected the request');
    await expect(
      uploadService.uploadNewFile('token-123', 'report.pdf', 'application/pdf', Buffer.alloc(2500, 'y')),
    ).rejects.toThrow();

    expect(eventPublisher.publishedEvents).toHaveLength(0);
  });

  it('rejects an empty file before touching the backend or metadata service', async () => {
    await expect(
      uploadService.uploadNewFile('token-123', 'empty.txt', 'text/plain', Buffer.alloc(0)),
    ).rejects.toThrow('Cannot upload an empty file');

    expect(backend.store.size).toBe(0);
    expect(metadataClient.registerFileCalls).toHaveLength(0);
  });

  it('cleans up stored chunks if metadata registration fails', async () => {
    metadataClient.registerFileError = new Error('metadata service rejected the request');
    const buffer = Buffer.alloc(2500, 'y');

    await expect(
      uploadService.uploadNewFile('token-123', 'report.pdf', 'application/pdf', buffer),
    ).rejects.toThrow('metadata service rejected the request');

    expect(backend.store.size).toBe(0);
  });

  it('adds a new version referencing the existing file id and publishes an enriched event', async () => {
    metadataClient.addVersionResult = {
      version: {
        id: 'version-2',
        fileId: 'file-1',
        versionNumber: 2,
        sizeBytes: 1500,
        mimeType: 'application/pdf',
        checksum: 'v2-checksum',
        createdAt: 'now',
      },
      chunks: [
        {
          id: 'chunk-v2',
          fileVersionId: 'version-2',
          chunkIndex: 0,
          sizeBytes: 1500,
          checksum: 'cv2',
          storageKey: 'session/0',
        },
      ],
    };
    // uploadNewVersion looks up the owning file for the event's owner/name.
    metadataClient.fileDetailResult = {
      file: {
        id: 'file-1',
        ownerId: 'owner-1',
        fileName: 'report.pdf',
        isDeleted: false,
        createdAt: 'now',
        updatedAt: 'now',
      },
      versions: [],
    };

    await uploadService.uploadNewVersion(
      'token-123',
      'file-1',
      'application/pdf',
      Buffer.alloc(1500, 'z'),
    );

    expect(metadataClient.addVersionCalls).toHaveLength(1);
    expect(metadataClient.addVersionCalls[0].fileId).toBe('file-1');
    expect(backend.store.size).toBe(2);

    expect(eventPublisher.publishedEvents).toHaveLength(1);
    const event = eventPublisher.publishedEvents[0];
    expect(event.fileId).toBe('file-1');
    expect(event.ownerId).toBe('owner-1');
    expect(event.versionNumber).toBe(2);
  });
});
