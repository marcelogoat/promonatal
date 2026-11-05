import { fileURLToPath } from 'node:url';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { geoResponse } from './src/server/geo';
import { createPixResponse, pixStatusResponse } from './src/server/pix';

type Middleware = (req: IncomingMessage, res: ServerResponse, next: () => void) => void;
type DevServer = { middlewares: { use: (route: string, handler: Middleware) => void } };

async function sendResponse(response: Response, res: ServerResponse) {
  res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
  res.end(await response.text());
}

async function geoMiddleware(req: IncomingMessage, res: ServerResponse, next: () => void) {
  if (req.url !== '/' && req.url !== '') return next();
  if (req.method !== 'GET') {
    res.writeHead(405, { Allow: 'GET' }).end();
    return;
  }
  const remote = req.socket.remoteAddress;
  const ip = remote === '::1' || remote === '127.0.0.1' ? null : remote;
  const response = await geoResponse({ ip });
  await sendResponse(response, res);
}

function apiPlugin(apiKey: string) {
  async function pixMiddleware(req: IncomingMessage, res: ServerResponse, next: () => void) {
    const path = (req.url ?? '/').split('?')[0];
    if (path === '/create') {
      if (req.method !== 'POST') return next();
      const chunks: Uint8Array[] = [];
      let size = 0;
      for await (const chunk of req) {
        const bytes = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
        size += bytes.length;
        if (size > 1_000_000) {
          res.writeHead(413).end();
          return;
        }
        chunks.push(bytes);
      }
      const request = new Request('http://localhost/api/pix/create', {
        method: 'POST',
        headers: { 'Content-Type': req.headers['content-type'] ?? 'application/json' },
        body: Buffer.concat(chunks),
      });
      await sendResponse(await createPixResponse(request, apiKey), res);
      return;
    }
    const match = path.match(/^\/status\/([^/]+)$/);
    if (match && req.method === 'GET') {
      await sendResponse(await pixStatusResponse(decodeURIComponent(match[1]), apiKey), res);
      return;
    }
    next();
  }
  const register = (server: DevServer) => {
    server.middlewares.use('/api/geo', geoMiddleware);
    server.middlewares.use('/api/pix', pixMiddleware);
  };
  return { name: 'local-api-endpoints', configureServer: register, configurePreviewServer: register };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), apiPlugin(env.VENO_API_KEY ?? env.VENO_SECRET_KEY ?? env.BLACKCAT_SECRET_KEY ?? '')],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    server: { port: 5173, strictPort: true },
  };
});
