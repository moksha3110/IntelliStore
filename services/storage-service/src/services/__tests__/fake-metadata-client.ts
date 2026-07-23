import type {
  AddVersionPayload,
  ChunkDto,
  FileDetailResult,
  FileVersionDto,
  MetadataClient,
  RegisterFilePayload,
  RegisterFileResult,
  VersionDetailResult,
} from '../../clients/metadata.client';

export class FakeMetadataClient implements MetadataClient {
  registerFileCalls: { bearerToken: string; payload: RegisterFilePayload }[] = [];
  addVersionCalls: { bearerToken: string; fileId: string; payload: AddVersionPayload }[] = [];

  registerFileResult: RegisterFileResult | null = null;
  registerFileError: Error | null = null;
  addVersionResult: { version: FileVersionDto; chunks: ChunkDto[] } | null = null;

  fileDetailResult: FileDetailResult | null = null;
  versionDetailResult: VersionDetailResult | null = null;

  async registerFile(
    bearerToken: string,
    payload: RegisterFilePayload,
  ): Promise<RegisterFileResult> {
    this.registerFileCalls.push({ bearerToken, payload });
    if (this.registerFileError) throw this.registerFileError;
    if (!this.registerFileResult) throw new Error('registerFileResult not configured');
    return this.registerFileResult;
  }

  async addVersion(
    bearerToken: string,
    fileId: string,
    payload: AddVersionPayload,
  ): Promise<{ version: FileVersionDto; chunks: ChunkDto[] }> {
    this.addVersionCalls.push({ bearerToken, fileId, payload });
    if (!this.addVersionResult) throw new Error('addVersionResult not configured');
    return this.addVersionResult;
  }

  async getFileDetail(_bearerToken: string, _fileId: string): Promise<FileDetailResult> {
    if (!this.fileDetailResult) throw new Error('fileDetailResult not configured');
    return this.fileDetailResult;
  }

  async getVersionDetail(
    _bearerToken: string,
    _fileId: string,
    _versionNumber: number,
  ): Promise<VersionDetailResult> {
    if (!this.versionDetailResult) throw new Error('versionDetailResult not configured');
    return this.versionDetailResult;
  }
}
