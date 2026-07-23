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

  it('stores each chunk in the backend and registers the file with matching metadata', async () => {
    metadataClient.registerFileResult = makeFileRegisterResult();
    const buffer = Buffer.alloc(2500, 'x');

    await uploadService.uploadNewFile('token-123', 'report.pdf', 'application/pdf', buffer);

    expect(backend.store.size).toBe(3);
    expect(metadataClient.registerFileCalls).toHaveLength(1);

    const call = metadataClient.registerFileCalls[0];
    expect(call.bearerToken).toBe('token-123');
    expect(call.payload.fileName).toBe('report.pdf');
    expect(call.payload.chunks).toHaveLength(3);
    expect(call.payload.chunks.map((c) => c.sizeBytes)).toEqual([1000, 1000, 500]);

    for (const chunk of call.payload.chunks) {
      expect(backend.store.has(chunk.storageKey)).toBe(true);
    }
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
    expect(event.versionId).toBe('version-1');
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

  it('adds a new version referencing the existing file id', async () => {
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
      chunks: [],
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
  });
});
