'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ApiError,
  downloadFile,
  getAnalyticsOverview,
  getFileRecommendations,
  uploadFile,
  type FileRecommendationDto,
  type OverviewDto,
} from '../../lib/api';
import { getStoredSession } from '../../lib/auth-storage';
import { formatBytes, formatRelativeTime } from '../../lib/format';

export default function DashboardPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [overview, setOverview] = useState<OverviewDto | null>(null);
  const [files, setFiles] = useState<FileRecommendationDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const loadData = useCallback(async () => {
    setError(null);
    try {
      const [overviewResult, filesResult] = await Promise.all([
        getAnalyticsOverview(),
        getFileRecommendations(),
      ]);
      setOverview(overviewResult);
      setFiles(filesResult);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load dashboard data.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!getStoredSession()) {
      router.push('/login');
      return;
    }
    void loadData();
  }, [router, loadData]);

  async function handleDownload(fileId: string, fileName: string) {
    try {
      await downloadFile(fileId, fileName);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Download failed.');
    }
  }

  async function handleFileSelected() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError(null);
    try {
      await uploadFile(file);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Upload failed.');
    } finally {
      setIsUploading(false);
    }
  }

  if (isLoading) {
    return (
      <main className="flex min-h-[calc(100vh-73px)] items-center justify-center bg-slate-950">
        <p className="text-slate-400">Loading dashboard…</p>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-73px)] bg-slate-950">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="text-2xl font-semibold text-white">Storage Analytics</h1>
        <p className="mt-1 text-sm text-slate-400">
          AI-driven hot/cold classification, replication health, and storage recommendations.
        </p>

        {error && (
          <p className="mt-4 rounded-md bg-red-950/60 px-3 py-2 text-sm text-red-300">{error}</p>
        )}

        {overview && (
          <>
            <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Files" value={String(overview.storage.totalFiles)} />
              <StatCard label="Total storage" value={formatBytes(overview.storage.totalBytes)} />
              <StatCard label="Chunks" value={String(overview.storage.totalChunks)} />
              <StatCard
                label="Healthy nodes"
                value={`${overview.diagnostics.healthyNodes} / ${overview.diagnostics.totalNodes}`}
              />
            </section>

            {overview.storage.dedupedBytes > 0 && (
              <section className="mt-4 flex items-center justify-between rounded-xl border border-emerald-800/50 bg-emerald-950/30 px-5 py-4">
                <div>
                  <p className="text-sm font-medium text-emerald-300">Deduplication</p>
                  <p className="text-xs text-slate-400">
                    Identical chunks are stored once via content-addressed storage.
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-semibold text-emerald-300">
                    {formatBytes(overview.storage.dedupedBytes)} saved
                  </p>
                  <p className="text-xs text-slate-400">
                    {formatBytes(overview.storage.physicalChunkBytes)} stored of{' '}
                    {formatBytes(overview.storage.logicalChunkBytes)} logical
                  </p>
                </div>
              </section>
            )}

            {overview.recommendations.length > 0 && (
              <section className="mt-8">
                <h2 className="text-lg font-medium text-slate-100">Recommendations</h2>
                <ul className="mt-3 space-y-2">
                  {overview.recommendations.map((recommendation) => (
                    <li
                      key={recommendation}
                      className="rounded-lg border border-brand-800/60 bg-brand-950/40 px-4 py-3 text-sm text-brand-100"
                    >
                      {recommendation}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="mt-8">
              <h2 className="text-lg font-medium text-slate-100">Storage nodes</h2>
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
                {overview.nodes.map((node) => {
                  const utilization =
                    node.capacityBytes > 0 ? node.usedBytes / node.capacityBytes : 0;
                  return (
                    <div
                      key={node.id}
                      className="rounded-xl border border-brand-800/60 bg-brand-950/40 p-4"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-slate-100">{node.name}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            node.isHealthy
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-red-500/20 text-red-300'
                          }`}
                        >
                          {node.isHealthy ? 'healthy' : 'unhealthy'}
                        </span>
                      </div>
                      <div className="mt-3 h-2 w-full rounded-full bg-slate-800">
                        <div
                          className="h-2 rounded-full bg-brand-500"
                          style={{ width: `${Math.min(utilization * 100, 100)}%` }}
                        />
                      </div>
                      <p className="mt-2 text-xs text-slate-400">
                        {formatBytes(node.usedBytes)} / {formatBytes(node.capacityBytes)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}

        <section className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-slate-100">Files</h2>
            <label className="cursor-pointer rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-500">
              {isUploading ? 'Uploading…' : 'Upload file'}
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelected}
                disabled={isUploading}
                className="hidden"
              />
            </label>
          </div>

          {files.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400">
              No files yet — upload one to see AI hot/cold recommendations.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-xl border border-brand-800/60">
              <table className="w-full text-left text-sm">
                <thead className="bg-brand-950/60 text-slate-300">
                  <tr>
                    <th className="px-4 py-2 font-medium">Name</th>
                    <th className="px-4 py-2 font-medium">Size</th>
                    <th className="px-4 py-2 font-medium">Accesses</th>
                    <th className="px-4 py-2 font-medium">Last accessed</th>
                    <th className="px-4 py-2 font-medium">Tier</th>
                    <th className="px-4 py-2 font-medium">Recommendation</th>
                    <th className="px-4 py-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-900/60">
                  {files.map((file) => (
                    <tr key={file.fileId} className="text-slate-200">
                      <td className="px-4 py-3">{file.fileName}</td>
                      <td className="px-4 py-3">{formatBytes(file.sizeBytes)}</td>
                      <td className="px-4 py-3">{file.accessCount}</td>
                      <td className="px-4 py-3">{formatRelativeTime(file.lastAccessedAt)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            file.temperature.tier === 'hot'
                              ? 'bg-orange-500/20 text-orange-300'
                              : 'bg-sky-500/20 text-sky-300'
                          }`}
                        >
                          {file.temperature.tier} · {file.temperature.score}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-400">{file.temperature.recommendation}</td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => handleDownload(file.fileId, file.fileName)}
                          className="text-brand-300 hover:text-brand-200"
                        >
                          Download
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-brand-800/60 bg-brand-950/40 p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}
