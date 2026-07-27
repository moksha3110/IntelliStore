import { type Express } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import type { Logger } from '@intellistore/shared-logger';
import { config } from '../config';

export interface Route {
  prefix: string;
  target: string;
  // Path the prefix is rewritten to on the upstream (the upstream's own base path).
  rewriteTo: string;
}

// Public gateway paths -> upstream service + base path. The frontend only ever
// talks to the gateway origin; these prefixes are the single public API surface.
export const routes: Route[] = [
  { prefix: '/api/auth', target: config.upstreams.auth, rewriteTo: '/auth' },
  { prefix: '/api/files', target: config.upstreams.metadata, rewriteTo: '/files' },
  { prefix: '/api/storage', target: config.upstreams.storage, rewriteTo: '/files' },
  { prefix: '/api/replication', target: config.upstreams.replication, rewriteTo: '' },
  { prefix: '/api/analytics', target: config.upstreams.aiAnalytics, rewriteTo: '/analytics' },
];

export function mountProxies(app: Express, logger: Logger): void {
  for (const route of routes) {
    app.use(
      route.prefix,
      createProxyMiddleware({
        target: route.target,
        changeOrigin: true,
        // Rewrite the gateway prefix to the upstream's base path. e.g.
        // /api/auth/login -> /auth/login, /api/replication/nodes -> /nodes.
        pathRewrite: (path) => `${route.rewriteTo}${path}`,
        on: {
          proxyRes: (proxyRes) => {
            // The gateway's own cors() middleware is the single CORS authority.
            // Upstream services also set CORS headers; letting both through
            // yields a duplicated Access-Control-Allow-Origin that browsers
            // reject, so strip the upstream's here.
            delete proxyRes.headers['access-control-allow-origin'];
            delete proxyRes.headers['access-control-allow-credentials'];
            delete proxyRes.headers['access-control-allow-methods'];
            delete proxyRes.headers['access-control-allow-headers'];
            delete proxyRes.headers['access-control-expose-headers'];
          },
          error: (err, _req, res) => {
            logger.error({ err, target: route.target }, 'upstream proxy error');
            // res can be a ServerResponse; guard before writing.
            if ('writeHead' in res && !res.headersSent) {
              res.writeHead(502, { 'Content-Type': 'application/json' });
              res.end(
                JSON.stringify({
                  success: false,
                  error: { code: 'BAD_GATEWAY', message: 'Upstream service is unavailable' },
                }),
              );
            }
          },
        },
      }),
    );
    logger.info(`proxy ${route.prefix}/* -> ${route.target}${route.rewriteTo}/*`);
  }
}

export const upstreamTargets = routes.reduce<Record<string, string>>((acc, r) => {
  acc[r.prefix] = r.target;
  return acc;
}, {});
