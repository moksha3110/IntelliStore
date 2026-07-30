import { describe, expect, it } from 'vitest';
import { routes } from './proxy';

// The pathRewrite each route applies: gateway prefix -> upstream base path.
function rewrite(rewriteTo: string, path: string): string {
  return `${rewriteTo}${path}`;
}

describe('gateway routes', () => {
  it('exposes exactly the upstream prefixes', () => {
    expect(routes.map((r) => r.prefix)).toEqual([
      '/api/auth',
      '/api/files',
      '/api/storage',
      '/api/replication',
      '/api/analytics',
      '/api/notifications',
    ]);
  });

  it('rewrites notification paths to the notification-service base', () => {
    const notif = routes.find((r) => r.prefix === '/api/notifications')!;
    expect(notif.target).toContain('4006');
    expect(rewrite(notif.rewriteTo, '/abc/read')).toBe('/notifications/abc/read');
  });

  it('rewrites auth paths to the auth-service base', () => {
    const auth = routes.find((r) => r.prefix === '/api/auth')!;
    // Express strips the mount prefix, so the middleware sees "/login".
    expect(rewrite(auth.rewriteTo, '/login')).toBe('/auth/login');
  });

  it('routes /api/storage to the storage-service /files base (upload/download)', () => {
    const storage = routes.find((r) => r.prefix === '/api/storage')!;
    expect(storage.target).toContain('4003');
    expect(rewrite(storage.rewriteTo, '/abc123/download')).toBe('/files/abc123/download');
  });

  it('routes /api/files to metadata-service and /api/storage to storage-service (disambiguating the shared /files path)', () => {
    const files = routes.find((r) => r.prefix === '/api/files')!;
    const storage = routes.find((r) => r.prefix === '/api/storage')!;
    expect(files.target).toContain('4002');
    expect(storage.target).toContain('4003');
    // Both ultimately hit a "/files" base on their respective services.
    expect(rewrite(files.rewriteTo, '')).toBe('/files');
    expect(rewrite(storage.rewriteTo, '')).toBe('/files');
  });

  it('passes replication paths through unchanged (empty base)', () => {
    const repl = routes.find((r) => r.prefix === '/api/replication')!;
    expect(rewrite(repl.rewriteTo, '/nodes')).toBe('/nodes');
    expect(rewrite(repl.rewriteTo, '/diagnostics')).toBe('/diagnostics');
  });

  it('rewrites analytics paths to the analytics base', () => {
    const ai = routes.find((r) => r.prefix === '/api/analytics')!;
    expect(rewrite(ai.rewriteTo, '/overview')).toBe('/analytics/overview');
  });
});
