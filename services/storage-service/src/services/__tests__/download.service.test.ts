import { beforeEach, describe, expect, it } from 'vitest';
import { sha256 } from '../../chunking/chunking.service';
import { DownloadService } from '../download.service';
import { FakeEventPublisher } from './fake-event-publisher';
import { FakeMetadataClient } from './fake-metadata-client';
import { InMemoryStorageBackend } from './in-memory-storage-backend';

describe('DownloadService', () => {
  let backend: InMemoryStorageBackend;
  let metadataClient: FakeMetadataClient;
  let eventPublisher: FakeEventPublisher;
  let downloadService: DownloadService;

  const original = Buffer.from('the quick brown fox jumps over the lazy dog');
  const chunkA = original.subarray(0, 20);
  const chunkB = original.subarray(20);

  beforeEach(async () => {
    backend = new InMemoryStorageBackend();
    metadataClient = new FakeMetadataClient();
    eventPublisher = new FakeEventPublisher();
    downloadService = new DownloadService(backend, metadataClient, eventPublisher);

    await backend.put('session-1/0', chunkA);
    await backend.put('session-1/1', chunkB);

    metadataClient.fileDetailResult = {
      file: {
        id: 'file-1',
        ownerId: 'owner-1',
        fileName: 'story.txt',
        isDeleted: false,
        createdAt: 'now',
        updatedAt: 'now',
      },
      versions: [
        {
          id: 'version-2',
          fileId: 'file-1',
          versionNumber: 2,
          sizeBytes: original.length,
          mimeType: 'text/plain',
          checksum: sha256(original),
          createdAt: 'now',
        },
      ],
    };

    metadataClient.versionDetailResult = {
      version: metadataClient.fileDetailResult.versions[0],
      chunks: [
        {
          id: 'chunk-0',
          fileVersionId: 'version-2',
          chunkIndex: 0,
          sizeBytes: chunkA.length,
          checksum: sha256(chunkA),
          storageKey: 'session-1/0',
        },
        {
          id: 'chunk-1',
          fileVersionId: 'version-2',
          chunkIndex: 1,
          sizeBytes: chunkB.length,
          checksum: sha256(chunkB),
          storageKey: 'session-1/1',
        },
      ],
    };
  });

  it('reassembles chunks in order and verifies the checksum', async () => {
    const result = await downloadService.download('token-123', 'file-1');

    expect(result.buffer.equals(original)).toBe(true);
    expect(result.fileName).toBe('story.txt');
    expect(result.mimeType).toBe('text/plain');
    expect(result.versionNumber).toBe(2);
  });

  it('publishes a file-accessed event on a successful download', async () => {
    await downloadService.download('token-123', 'file-1');

    expect(eventPublisher.accessEvents).toHaveLength(1);
    expect(eventPublisher.accessEvents[0]).toMatchObject({ fileId: 'file-1', versionId: 'version-2' });
  });

  it('throws an integrity error when the reconstructed checksum does not match', async () => {
    metadataClient.versionDetailResult!.version.checksum = 'tampered-checksum';

    await expect(downloadService.download('token-123', 'file-1')).rejects.toThrow(
      'failed checksum verification',
    );

    expect(eventPublisher.accessEvents).toHaveLength(0);
  });

  it('throws not-found when the file has no versions', async () => {
    metadataClient.fileDetailResult!.versions = [];

    await expect(downloadService.download('token-123', 'file-1')).rejects.toThrow(
      'File has no versions',
    );
  });
});
