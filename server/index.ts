import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import api from '../functions/index.js';

const rootDir = process.cwd();
const distDir = path.join(rootDir, 'dist');
const port = Number(process.env.PORT || 3000);

const mimeTypes: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    if (url.pathname.startsWith('/api/')) {
      await handleApi(req, res, url);
      return;
    }

    await serveStatic(url.pathname, res);
  } catch (error: any) {
    sendText(res, 500, error?.message || 'Internal Server Error');
  }
}).listen(port, () => {
  console.log(`EAS is running at http://localhost:${port}`);
});

async function handleApi(req: IncomingMessage, res: ServerResponse, url: URL) {
  const body = ['GET', 'HEAD'].includes(req.method || 'GET') ? undefined : await readBody(req);
  const request = new Request(url.toString(), {
    method: req.method,
    headers: req.headers as HeadersInit,
    body: body ? toArrayBuffer(body) : undefined,
  });

  const response = await api.fetch(request);
  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));
  res.end(Buffer.from(await response.arrayBuffer()));
}

async function serveStatic(pathname: string, res: ServerResponse) {
  const requestedPath = decodeURIComponent(pathname === '/' ? '/index.html' : pathname);
  const absolutePath = path.resolve(distDir, `.${requestedPath}`);
  const filePath = absolutePath.startsWith(distDir) && await isFile(absolutePath)
    ? absolutePath
    : path.join(distDir, 'index.html');

  const ext = path.extname(filePath).toLowerCase();
  const content = await readFile(filePath);
  res.statusCode = 200;
  res.setHeader('content-type', mimeTypes[ext] || 'application/octet-stream');
  res.end(content);
}

async function isFile(filePath: string) {
  try {
    return (await stat(filePath)).isFile();
  } catch {
    return false;
  }
}

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  const copy = new Uint8Array(buffer.byteLength);
  copy.set(buffer);
  return copy.buffer;
}

function sendText(res: ServerResponse, status: number, text: string) {
  res.statusCode = status;
  res.setHeader('content-type', 'text/plain; charset=utf-8');
  res.end(text);
}
