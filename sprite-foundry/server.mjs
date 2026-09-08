#!/usr/bin/env node
// server.mjs — zero-dependency production server for Sprite Foundry.
// Serves the static app AND hosts the server-side OpenAI image provider so
// API keys never touch frontend JavaScript. The app also works fully static
// (any static server / file host) — then only browser-direct providers are
// offered and /api/* reports itself unavailable.
//
//   node server.mjs           → http://0.0.0.0:4173
//   OPENAI_API_KEY=sk-... node server.mjs   (or copy .env.example → .env)
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const APP = join(ROOT, 'app');
const PORT = Number(process.env.PORT || 4173);

loadEnvFile();

const OPENAI_KEY = process.env.OPENAI_API_KEY || null;
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
  '.spriteproject': 'application/zip', '.zip': 'application/zip',
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith('/api/')) return handleApi(req, res, url);
    return serveStatic(req, res, url);
  } catch (e) {
    console.error(e);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: String(e.message || e) }));
  }
});

async function serveStatic(req, res, url) {
  let path = normalize(url.pathname).replace(/^(\.\.[/\\])+/, '');
  if (path === '/' || path === '\\') path = '/index.html';
  const file = join(APP, path);
  if (!file.startsWith(APP)) { res.writeHead(403); return res.end('forbidden'); }
  try {
    const st = await stat(file);
    if (st.isDirectory()) { res.writeHead(404); return res.end('not found'); }
    const data = await readFile(file);
    res.writeHead(200, {
      'Content-Type': MIME[extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': path === '/index.html' ? 'no-cache' : 'public, max-age=60',
      'Content-Length': data.length,
    });
    res.end(data);
  } catch {
    res.writeHead(404); res.end('not found');
  }
}

// ---------------------------------------------------------------- api

async function handleApi(req, res, url) {
  const send = (code, obj) => {
    res.writeHead(code, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(obj));
  };
  if (url.pathname === '/api/capabilities') {
    return send(200, {
      providers: [{
        id: 'openai',
        configured: !!OPENAI_KEY,
        note: OPENAI_KEY
          ? 'OPENAI_API_KEY present (server-side only). gpt-image-1 available.'
          : 'No OPENAI_API_KEY in environment → server-side OpenAI provider disabled. Browser providers may still work.',
      }],
    });
  }
  if (!['POST'].includes(req.method)) return send(405, { error: 'method not allowed' });
  let body;
  try { body = JSON.parse(await readBody(req, 40 * 1024 * 1024)); }
  catch (e) { return send(413, { error: `request body problem: ${e.message}` }); }

  const op = url.pathname.replace('/api/', '');
  if (body.provider !== 'openai') return send(400, { error: `Unknown server provider "${body.provider}" (browser providers are called directly by the page)` });
  if (!OPENAI_KEY) return send(503, { error: 'OPENAI_API_KEY is not configured on this server', code: 'missing-credential' });

  try {
    if (op === 'generate') {
      const out = await openaiGenerate(body);
      return send(200, { ok: true, ...out });
    }
    if (op === 'edit' || op === 'inpaint' || op === 'between') {
      const out = await openaiEdit(body, op === 'inpaint');
      return send(200, { ok: true, ...out });
    }
    return send(404, { error: `unknown api operation "${op}"` });
  } catch (e) {
    console.error(`[api/${op}]`, e.message);
    return send(502, { error: `OpenAI request failed: ${e.message}` });
  }
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', c => {
      total += c.length;
      if (total > limit) { reject(new Error('body too large')); req.destroy(); }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function dataUrlToBlob(dataUrl, fallbackName) {
  const m = /^data:(image\/[\w.+-]+);base64,(.+)$/.exec(dataUrl || '');
  if (!m) throw new Error(`invalid data URL for ${fallbackName}`);
  return { blob: new Blob([Buffer.from(m[2], 'base64')], { type: m[1] }), name: fallbackName };
}

function mapSize(width, height) {
  if (!width || !height) return 'auto';
  const r = width / height;
  if (r > 1.3) return '1536x1024';
  if (r < 0.77) return '1024x1536';
  return '1024x1024';
}

async function openaiGenerate(spec) {
  const body = { model: 'gpt-image-1', prompt: spec.prompt, n: 1, size: mapSize(spec.width, spec.height), output_format: 'png' };
  if (spec.background === 'transparent') body.background = 'transparent';
  if (spec.quality) body.quality = spec.quality;
  const json = await openaiFetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_KEY}` },
    body: JSON.stringify(body),
  });
  return { image: json.data[0].b64_json, mime: 'image/png', model: json.model || 'gpt-image-1' };
}

async function openaiEdit(spec, withMask) {
  const fd = new FormData();
  fd.set('model', 'gpt-image-1');
  fd.set('prompt', spec.prompt);
  fd.set('size', mapSize(spec.width, spec.height));
  if (spec.background === 'transparent') fd.set('background', 'transparent');
  const refs = spec.refs ?? [];
  if (!refs.length && !spec.image) throw new Error('edit/inpaint requires at least one reference image');
  if (spec.image && !refs.length) refs.push(spec.image);
  refs.forEach((ref, i) => {
    const { blob, name } = dataUrlToBlob(ref, `ref_${i}.png`);
    fd.append('image[]', blob, name);
  });
  if (withMask) {
    if (!spec.mask) throw new Error('inpaint requires a mask data URL');
    const { blob } = dataUrlToBlob(spec.mask, 'mask.png');
    fd.set('mask', blob, 'mask.png');
  }
  const json = await openaiFetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_KEY}` },
    body: fd,
  });
  return { image: json.data[0].b64_json, mime: 'image/png', model: json.model || 'gpt-image-1' };
}

async function openaiFetch(url, init) {
  let r;
  try { r = await fetch(url, init); }
  catch (e) { throw new Error(`network error reaching api.openai.com (${e.message})`); }
  let json = null;
  try { json = await r.json(); } catch { /* non-JSON error body */ }
  if (!r.ok) throw new Error(json?.error?.message || `HTTP ${r.status}`);
  const img = json?.data?.[0]?.b64_json;
  if (!img) throw new Error('no image returned (request may have been rejected)');
  return json;
}

function loadEnvFile() {
  // minimal .env support (KEY=VALUE lines, no deps) — secrets stay server-side
  try {
    const text = readFileSync(join(ROOT, '.env'), 'utf8');
    for (const line of text.split('\n')) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch { /* no .env — fine */ }
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Sprite Foundry → http://localhost:${PORT}  (openai: ${OPENAI_KEY ? 'key present' : 'no key — browser providers only'})`);
});
