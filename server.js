// A small web server with no extra libraries.
// Job 1: send the files in public/ to your browser.
// Job 2: host private "API" routes (like label scanning) that need secrets,
//        so your Claude API key stays here on the server and never reaches the phone.

import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { scanLabelImage, ScanError } from './scanner.js';

const ROOT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');

// Load secrets from a .env file: the project folder (your computer), or
// /etc/secrets/.env (a "Secret File" on Render). Missing files are skipped.
for (const envFile of [path.join(ROOT_DIR, '.env'), '/etc/secrets/.env']) {
  try {
    process.loadEnvFile(envFile);
  } catch {
    // Not there — that's fine.
  }
}

const PORT = Number(process.env.PORT) || 3000;

// Websites allowed to call this server's API from a browser (comma-separated).
// Your GitHub Pages site is allowed by default.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://omar-elnaggar1.github.io')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const MAX_BODY_BYTES = 8 * 1024 * 1024; // plenty for a shrunk photo
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // Claude's per-image limit
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const SCANS_PER_HOUR = Number(process.env.SCANS_PER_HOUR) || 30;

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

function sendError(res, status, code) {
  sendJson(res, status, { error: code });
}

/** Reads the request body, refusing anything larger than `limit` bytes. */
async function readBody(req, limit) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new ScanError('too_large', 413);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

// A simple per-visitor limit so a leaked server address can't run up your Claude bill.
const scanTimes = new Map();
function overScanLimit(req) {
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  const hourAgo = Date.now() - 60 * 60 * 1000;
  const recent = (scanTimes.get(ip) || []).filter((time) => time > hourAgo);
  recent.push(Date.now());
  scanTimes.set(ip, recent);
  return recent.length > SCANS_PER_HOUR;
}

// ---- API routes ----------------------------------------------------------

// The phone sends a shrunk label photo here; we forward it to Claude using
// ANTHROPIC_API_KEY. Keeping the call on the server is what keeps the key secret.
async function handleScanLabel(req, res) {
  if (!process.env.ANTHROPIC_API_KEY) return sendError(res, 503, 'not_configured');
  if (overScanLimit(req)) return sendError(res, 429, 'too_many_scans');

  try {
    let body;
    try {
      body = JSON.parse(await readBody(req, MAX_BODY_BYTES));
    } catch (err) {
      if (err instanceof ScanError) throw err;
      throw new ScanError('bad_image', 400);
    }

    const { image, mediaType } = body || {};
    if (typeof image !== 'string' || !IMAGE_TYPES.has(mediaType) || !/^[A-Za-z0-9+/]+=*$/.test(image)) {
      throw new ScanError('bad_image', 400);
    }
    if ((image.length * 3) / 4 > MAX_IMAGE_BYTES) throw new ScanError('too_large', 413);

    const result = await scanLabelImage({ imageBase64: image, mediaType });
    sendJson(res, 200, result);
  } catch (err) {
    if (err instanceof ScanError) return sendError(res, err.status, err.code);
    throw err;
  }
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

/** Lets your GitHub Pages site call this server (browsers block other sites by default). */
function applyCors(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Max-Age', '86400');
    res.setHeader('Vary', 'Origin');
  }
}

const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');
  try {
    if (pathname.startsWith('/api/')) {
      applyCors(req, res);
      if (req.method === 'OPTIONS') {
        res.writeHead(204).end();
        return;
      }
    }
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
  console.log(`  Label scanning: ${process.env.ANTHROPIC_API_KEY ? 'ON' : 'OFF (no ANTHROPIC_API_KEY in .env)'}`);
  console.log(`  On this computer:  http://localhost:${PORT}`);
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const a of addrs || []) {
      if (a.family === 'IPv4' && !a.internal) console.log(`  On your phone (same Wi-Fi):  http://${a.address}:${PORT}`);
    }
  }
});
