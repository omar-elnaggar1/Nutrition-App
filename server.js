// A small web server with no extra libraries.
// Job 1: send the files in public/ to your browser.
// Job 2: host private "API" routes (like label scanning) that need secrets,
//        so your Claude API key stays here on the server and never reaches the phone.

import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

// Load secrets from .env if it exists (it's optional in Phase 1).
try {
  process.loadEnvFile();
} catch {
  // No .env file yet — that's fine.
}

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public');

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

// ---- API routes ----------------------------------------------------------

// Phase 2 placeholder: the phone will send a photo of a nutrition label here,
// and this route will forward it to the Claude API using ANTHROPIC_API_KEY.
// Keeping the call on the server is what keeps the key secret.
async function handleScanLabel(req, res) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return sendJson(res, 503, { error: 'Label scanning is not set up yet: ANTHROPIC_API_KEY is missing from .env.' });
  }
  return sendJson(res, 501, { error: 'Label scanning is coming in Phase 2.' });
}

const API_ROUTES = {
  'GET /api/health': (req, res) => sendJson(res, 200, { ok: true, scanningConfigured: Boolean(process.env.ANTHROPIC_API_KEY) }),
  'POST /api/scan-label': handleScanLabel,
};

// ---- Static files --------------------------------------------------------

async function serveStatic(req, res, pathname) {
  const relative = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).replace(/^\/+/, '');
  const filePath = path.resolve(PUBLIC_DIR, relative);

  // Block requests like /../server.js that try to escape the public folder.
  if (!filePath.startsWith(PUBLIC_DIR + path.sep)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  try {
    const data = await fs.readFile(filePath);
    const type = CONTENT_TYPES[path.extname(filePath)] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
  }
}

const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');
  try {
    const route = API_ROUTES[`${req.method} ${pathname}`];
    if (route) return await route(req, res);
    if (pathname.startsWith('/api/')) return sendJson(res, 404, { error: 'Unknown API route' });
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405).end('Method not allowed');
      return;
    }
    await serveStatic(req, res, pathname);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) sendJson(res, 500, { error: 'Server error' });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Nutrition app running!`);
  console.log(`  On this computer:  http://localhost:${PORT}`);
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const a of addrs || []) {
      if (a.family === 'IPv4' && !a.internal) console.log(`  On your phone (same Wi-Fi):  http://${a.address}:${PORT}`);
    }
  }
});
