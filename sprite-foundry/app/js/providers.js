// providers.js — the image-generation provider layer.
// Architecture: each provider exposes capabilities() honestly, plus generate/
// edit/inpaint/between where actually possible. The UI reads capabilities at
// runtime and disables (with explanation) anything a provider can't do.
// No provider in this file fabricates output.

import { uid } from './lib/model.js';

// -------------------------------------------------------------------- base

/**
 * Capability flags a provider can report:
 * t2i, i2i, references, multiReferences, seed, transparency, edit, inpaint,
 * batch, between, cancel
 */

// ---------------------------------------------------------------- pollinations (browser-direct, keyless)

class PollinationsProvider {
  id = 'pollinations';
  name = 'Pollinations (browser, keyless)';
  kind = 'client';
  constructor() { this.available = null; this.error = null; }
  async capabilities() {
    if (this.available === null) await this.probe();
    return {
      t2i: this.available, i2i: false, references: false, multiReferences: false,
      seed: true, transparency: false, edit: false, inpaint: false, batch: true,
      between: false, cancel: true,
      note: this.available
        ? 'Free keyless text-to-image (Flux). No reference-image or inpainting support — character continuity is prompt-driven. Generated on plain background; use background-keying + Pixel Lab to finish.'
        : `Unreachable from this browser${this.error ? ` (${this.error})` : ''}. Check network/ad-blockers for image.pollinations.ai.`,
    };
  }
  async probe() {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 20000);
      const r = await fetch('https://image.pollinations.ai/prompt/pixel?width=16&height=16&seed=1&nologo=true', { signal: ctrl.signal });
      clearTimeout(timer);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const blob = await r.blob();
      if (!blob.type.startsWith('image/')) throw new Error(`unexpected content-type ${blob.type}`);
      this.available = true;
    } catch (e) {
      this.available = false;
      this.error = e.message;
    }
    return this.available;
  }
  async generate({ prompt, width = 256, height = 256, seed = -1, signal }) {
    const w = Math.min(1280, Math.max(64, Math.round(width / 64) * 64));
    const h = Math.min(1280, Math.max(64, Math.round(height / 64) * 64));
    const params = new URLSearchParams({ width: String(w), height: String(h), nologo: 'true', referrer: 'sprite-foundry' });
    if (seed >= 0) params.set('seed', String(seed));
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt.slice(0, 1500))}?${params}`;
    const r = await fetch(url, { signal });
    if (!r.ok) throw new Error(`Pollinations HTTP ${r.status}`);
    const blob = await r.blob();
    if (!blob.type.startsWith('image/')) throw new Error(`Pollinations returned ${blob.type || 'non-image'} (generation rejected)`);
    return { blob, meta: { provider: this.id, model: 'flux (pollinations)', seed: seed >= 0 ? seed : undefined, width: w, height: h } };
  }
}

// ---------------------------------------------------------------- OpenAI via app server (key stays server-side)

class OpenAiServerProvider {
  id = 'openai';
  name = 'OpenAI gpt-image-1 (server key)';
  kind = 'server';
  constructor() { this.available = null; this.reason = null; }
  async capabilities() {
    if (this.available === null) await this.probe();
    if (!this.available) {
      return { t2i: false, i2i: false, references: false, multiReferences: false, seed: false, transparency: false, edit: false, inpaint: false, batch: false, between: false, cancel: true, note: this.reason || 'Server provider not configured' };
    }
    return {
      t2i: true, i2i: true, references: true, multiReferences: true, seed: false,
      transparency: true, edit: true, inpaint: true, batch: true, between: true, cancel: true,
      note: 'Server-side OPENAI_API_KEY (never exposed to the page). gpt-image-1 supports transparent background, image edits and masked inpainting.',
    };
  }
  async probe() {
    try {
      const r = await fetch('/api/capabilities');
      if (!r.ok) throw new Error(`server ${r.status}`);
      const info = await r.json();
      const me = info.providers?.find(p => p.id === 'openai');
      this.available = !!me?.configured;
      this.reason = me?.note ?? null;
    } catch (e) {
      this.available = false;
      this.reason = `app server unavailable (${e.message}) — run "node server.mjs" instead of opening the file directly`;
    }
    return this.available;
  }
  async generate(spec) { return this.request('generate', spec); }
  async edit(spec) { return this.request('edit', spec); }
  async inpaint(spec) { return this.request('inpaint', spec); }
  async between(spec) { return this.request('between', spec); }
  async request(op, spec) {
    // File/Blob refs must cross the JSON API as data URLs
    const refs = [];
    if (spec.refs?.length) {
      for (const ref of spec.refs) refs.push(await refToDataUrl(ref));
    }
    const image = spec.image && typeof spec.image !== 'string' ? await refToDataUrl(spec.image) : spec.image;
    const r = await fetch(`/api/${op}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'openai', prompt: spec.prompt, negative: spec.negative,
        width: spec.width, height: spec.height, seed: spec.seed,
        background: spec.background, mask: spec.mask ?? null,
        refs: refs.length ? refs : undefined, image,
      }),
      signal: spec.signal,
    });
    const json = await r.json().catch(() => null);
    if (!r.ok || !json?.ok) throw new Error(json?.error || `OpenAI request failed (HTTP ${r.status})`);
    const blob = await (await fetch(`data:${json.mime};base64,${json.image}`)).blob();
    return { blob, meta: { provider: this.id, model: json.model || 'gpt-image-1' } };
  }
}

// ---------------------------------------------------------------- OpenAI direct from browser (ephemeral user key)

class OpenAiDirectProvider {
  id = 'openai-direct';
  name = 'OpenAI gpt-image-1 (your key, this session only)';
  kind = 'client-key';
  constructor() { this.key = sessionStorage.getItem('sf-openai-key') || null; }
  setKey(key) {
    this.key = key || null;
    if (key) sessionStorage.setItem('sf-openai-key', key); // tab-scoped, never synced/persisted
    else sessionStorage.removeItem('sf-openai-key');
  }
  async capabilities() {
    const on = !!this.key;
    const caps = { t2i: on, i2i: on, references: on, multiReferences: on, seed: false, transparency: on, edit: on, inpaint: on, batch: on, between: on, cancel: true };
    caps.note = on
      ? 'Key is kept in this tab\u2019s session memory only and sent directly from your browser to api.openai.com. Do not use on shared machines.'
      : 'Enter an OpenAI API key (session-only, never saved to disk or sent anywhere but OpenAI).';
    return caps;
  }
  headers() { return { Authorization: `Bearer ${this.key}` }; }
  async generate({ prompt, width, height, background, signal }) {
    const size = pickSize(width, height);
    const body = { model: 'gpt-image-1', prompt, n: 1, size, output_format: 'png' };
    if (background === 'transparent') body.background = 'transparent';
    const r = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...this.headers() }, body: JSON.stringify(body), signal,
    });
    return parseImageResponse(r, this);
  }
  async edit({ prompt, refs = [], width, height, background, signal }) {
    const fd = await buildEditForm({ prompt, refs, width, height, background });
    const r = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: this.headers(), body: fd, signal });
    return parseImageResponse(r, this);
  }
  inpaint = null; // assigned below
  async between(spec) { return this.edit(spec); } // multi-image edit with between prompt
}
// inpaint = edit with a mask image appended
OpenAiDirectProvider.prototype.inpaint = async function ({ prompt, image, mask, width, height, signal }) {
  const fd = await buildEditForm({ prompt, refs: [image], width, height, background: undefined });
  fd.set('mask', await dataUrlToFile(mask, 'mask.png'));
  const r = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: this.headers(), body: fd, signal });
  return parseImageResponse(r, this);
};

async function refToDataUrl(ref) {
  if (typeof ref === 'string') return ref;
  const blob = ref instanceof Blob ? ref : null;
  if (!blob) throw new Error('unsupported reference payload');
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(new Error('failed to read reference image'));
    fr.readAsDataURL(blob);
  });
}

function pickSize(w, h) {
  if (!w || !h) return 'auto';
  const ratio = w / h;
  if (ratio > 1.3) return '1536x1024';
  if (ratio < 0.77) return '1024x1536';
  return '1024x1024';
}
async function dataUrlToFile(dataUrl, name) {
  const blob = await (await fetch(dataUrl)).blob();
  return new File([blob], name, { type: blob.type || 'image/png' });
}
async function buildEditForm({ prompt, refs, width, height, background }) {
  const fd = new FormData();
  fd.set('model', 'gpt-image-1');
  fd.set('prompt', prompt);
  fd.set('size', pickSize(width, height));
  if (background === 'transparent') fd.set('background', 'transparent');
  for (let i = 0; i < refs.length; i++) {
    const ref = refs[i];
    const file = ref instanceof File || ref instanceof Blob ? ref : await dataUrlToFile(ref, `ref_${i}.png`);
    fd.append('image[]', file, file.name || `ref_${i}.png`);
  }
  return fd;
}
async function parseImageResponse(r, provider) {
  let json = null;
  try { json = await r.json(); } catch { /* fall through */ }
  if (!r.ok) throw new Error(json?.error?.message || `OpenAI HTTP ${r.status}`);
  const item = json?.data?.[0];
  if (!item?.b64_json) throw new Error('OpenAI returned no image (request may have been rejected by safety systems)');
  const blob = await (await fetch(`data:image/png;base64,${item.b64_json}`)).blob();
  return { blob, meta: { provider: provider.id, model: json.model || 'gpt-image-1' } };
}

// ---------------------------------------------------------------- registry + job queue

export class ProviderRegistry {
  constructor(store) {
    this.store = store;
    this.providers = [new PollinationsProvider(), new OpenAiServerProvider(), new OpenAiDirectProvider()];
    this.activeId = null;
    this.capsReport = [];
    this.queue = [];
    this.running = false;
  }

  get active() { return this.providers.find(p => p.id === this.activeId) ?? null; }

  async refresh() {
    this.capsReport = await Promise.all(this.providers.map(async p => ({ id: p.id, name: p.name, caps: await p.capabilities() })));
    const usable = this.capsReport.find(c => c.caps.t2i);
    if (usable && !this.active?.capabilities) this.activeId = usable.id;
    if (!this.activeId && usable) this.activeId = usable.id;
    this.store.emit('providers');
    return this.capsReport;
  }

  async caps(id) {
    const report = this.capsReport.find(c => c.id === id);
    if (report) return report.caps;
    return (await this.refresh()).find(c => c.id === id)?.caps ?? {};
  }

  setActive(id) { this.activeId = id; this.store.emit('providers'); }

  /**
   * Enqueue a generation operation as a tracked job.
   * job: { label, op, providerId, spec, onDone(result, job), onError(err, job), destId, animLabel }
   */
  enqueue(job) {
    const tracked = {
      id: uid('job'),
      status: 'queued',
      createdAt: Date.now(),
      progress: 0,
      controller: new AbortController(),
      ...job,
    };
    this.store.addJob(tracked);
    this.queue.push(tracked);
    this.pump();
    return tracked;
  }

  cancel(jobId) {
    const job = this.store.jobs.find(j => j.id === jobId);
    if (!job) return;
    job.controller.abort();
    if (job.status === 'queued') this.store.updateJob(job.id, { status: 'cancelled', finishedAt: Date.now() });
  }

  async pump() {
    if (this.running) return;
    const job = this.queue.shift();
    if (!job) return;
    this.running = true;
    this.store.updateJob(job.id, { status: 'generating', startedAt: Date.now() });
    const provider = this.providers.find(p => p.id === job.providerId) ?? this.active;
    try {
      const fn = provider[job.op] ?? provider.generate;
      if (typeof fn !== 'function') throw new Error(`Provider "${provider.name}" does not support operation "${job.op}"`);
      const result = await fn.call(provider, { ...job.spec, signal: job.controller.signal });
      if (job.controller.signal.aborted) throw new DOMException('aborted', 'AbortError');
      this.store.updateJob(job.id, { status: 'complete', finishedAt: Date.now(), progress: 1 });
      await job.onDone?.(result, job);
    } catch (e) {
      if (e.name === 'AbortError') this.store.updateJob(job.id, { status: 'cancelled', finishedAt: Date.now() });
      else {
        this.store.updateJob(job.id, { status: 'failed', finishedAt: Date.now(), error: e.message });
        job.onError?.(e, job);
      }
    } finally {
      this.running = false;
      this.pump();
    }
  }

  retry(jobId) {
    const old = this.store.jobs.find(j => j.id === jobId);
    if (!old || (old.status !== 'failed' && old.status !== 'cancelled')) return;
    this.store.updateJob(jobId, { status: 'queued', error: null });
    this.queue.push(old);
    old.controller = new AbortController();
    this.pump();
  }
}

export { PickNoneError };

class PickNoneError extends Error {}
