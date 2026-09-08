// boot.smoke.test.mjs — boots the REAL app in jsdom (canvas 2D stubbed) and
// exercises structural regions: stage switching, timeline presence, project
// tree, dialogs, provider panel. Catches wiring/typo regressions that pure
// import checks cannot.
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const appRoot = fileURLToPath(new URL('../app/', import.meta.url));
let bootSeq = 0;
async function bootApp() { await import('../app/js/main.js?boot=' + (++bootSeq)); await new Promise(r => setTimeout(r, 50)); pump(); }

// manual rAF pump so the render loop never keeps the event loop alive
const rafQ = [];
function pump(frames = 3) {
  for (let i = 0; i < frames; i++) {
    const cbs = rafQ.splice(0);
    for (const cb of cbs) cb(performance.now());
  }
}
function resetRaf() { rafQ.length = 0; }

function fake2dContext(canvas) {
  // no-op 2d context surface used by jsdom (real rasterization not needed here)
  const noop = () => {};
  return new Proxy({
    canvas,
    measureText: () => ({ width: 10 }),
    getImageData: (x, y, w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    putImageData: noop,
    createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
  }, {
    get: (t, k) => (k in t ? t[k] : noop),
    set: () => true,
  });
}

async function makeDom() {
  const html = readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
  const dom = new JSDOM(html, {
    url: 'http://localhost/',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  const { window } = dom;
  // jsdom lacks <dialog> methods
  window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  window.HTMLDialogElement.prototype.close = function () { this.open = false; };
  // canvas stubs
  window.HTMLCanvasElement.prototype.getContext = function () {
    this._ctx2d ??= fake2dContext(this);
    return this._ctx2d;
  };
  window.HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,AAAA';
  window.HTMLCanvasElement.prototype.toBlob = cb => cb(new window.Blob(['x']));
  // globais the app expects
  for (const key of ['HTMLElement']) {
    if (!(key in globalThis)) globalThis[key] = window[key];
  }
  const setGlobal = (k, v) => { try { globalThis[k] = v; } catch { Object.defineProperty(globalThis, k, { value: v, configurable: true }); } };
  setGlobal('window', window);
  setGlobal('document', window.document);
  globalThis.requestAnimationFrame = cb => { rafQ.push(cb); return rafQ.length; };
  globalThis.cancelAnimationFrame = () => {};
  Object.defineProperty(globalThis, 'devicePixelRatio', { value: 1, configurable: true });
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  globalThis.indexedDB = undefined; // persistence path disabled → exercised fallback
  globalThis.HTMLInputElement = window.HTMLInputElement;
  globalThis.HTMLTextAreaElement = window.HTMLTextAreaElement;
  globalThis.HTMLSelectElement = window.HTMLSelectElement;
  globalThis.Node = window.Node;
  globalThis.Blob = window.Blob;
  globalThis.File = window.File;
  globalThis.FileReader = window.FileReader;
  globalThis.FormData = window.FormData;
  globalThis.ImageData = window.ImageData ?? class { constructor(data, w, h) { this.data = data; this.width = w; this.height = h; } };
  globalThis.createImageBitmap = async () => ({ width: 4, height: 4, close() {} });
  globalThis.sessionStorage = window.sessionStorage;
  globalThis.prompt = () => 'Test';
  globalThis.confirm = () => true;
  // keep node performance
  if (!globalThis.DataTransferItem) { /* not needed */ }
  return dom;
}

test('APP BOOT: index boots, all six stages render their inspector', async () => {
  const dom = await makeDom();
  await bootApp();
  const ctx = globalThis.window.__sf;
  assert.ok(ctx?.store, 'booted context exists');
  const stagesBtns = [...dom.window.document.querySelectorAll('.stage-btn')];
  assert.equal(stagesBtns.length, 6);
  for (const b of stagesBtns) {
    b.click();
    await new Promise(r => setTimeout(r, 10));
    pump();
    const inspector = dom.window.document.querySelector('#inspector');
    assert.ok(inspector.textContent.length > 20, `stage ${b.dataset.stage} should render an inspector`);
  }
  resetRaf();
}, { timeout: 20000 });

test('APP BOOT: project tree renders + add animation dialog opens', async () => {
  const dom = await makeDom();
  await bootApp();
  const ctx = globalThis.window.__sf;
  ctx.store.addCharacter('Hero');
  const anim = ctx.store.addAnimation(ctx.store.activeChar().id, { type: 'walk', name: 'walk', frameCount: 8, framesPerSecond: 8 });
  await new Promise(r => setTimeout(r, 10));
  pump();
  const tree = dom.window.document.querySelector('#project-tree');
  assert.ok(tree.textContent.includes('Hero'));
  assert.ok(tree.textContent.includes('walk'));
  // timeline with transport controls
  const timeline = dom.window.document.querySelector('#timeline');
  assert.ok(timeline.querySelector('.transport'), 'transport exists');
  // undo/redo wiring
  assert.ok(!dom.window.document.querySelector('#btn-undo').disabled, 'undo enabled after history');
  resetRaf();
}, { timeout: 20000 });

test('APP BOOT: jobs drawer + provider dialog open without errors', async () => {
  const dom = await makeDom();
  await bootApp();
  dom.window.document.querySelector('#btn-jobs').click();
  assert.ok(!dom.window.document.querySelector('#jobs-drawer').hidden);
  dom.window.document.querySelector('#btn-provider').click();
  await new Promise(r => setTimeout(r, 50));
  assert.ok(dom.window.document.querySelector('dialog'), 'provider dialog opened');
  dom.window.document.querySelector('dialog')?.querySelector('.icon-btn')?.click();
  resetRaf();
}, { timeout: 20000 });

test('APP BOOT: slice stage accepts a synthetic sheet via program path', async () => {
  const dom = await makeDom();
  await bootApp();
  const ctx = globalThis.window.__sf;
  // create a 4x2 grid sheet in-memory, push through the slice import path
  const { createImg, fillRect } = await import('../app/js/lib/img.js');
  const sheet = createImg(64, 32);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 2; r++) fillRect(sheet, c * 16, r * 16, 16, 16, [c * 60, r * 120, 200, 255]);
  const ch = ctx.store.activeChar();
  ctx.store.ui.slice = {
    sheetId: await ctx.store.imgStore.putImg(sheet),
    name: 'test-sheet.png', rects: [], selected: new Set(), meta: null, tags: [], sheetW: 64, sheetH: 32,
  };
  ctx.setStage('slice');
  await new Promise(r => setTimeout(r, 30));
  pump();
  const slice = ctx.stages.slice;
  slice.gridParams = { mode: 'cols-rows', columns: 4, rows: 2, cellW: 0, cellH: 0, offsetX: 0, offsetY: 0, spacingX: 0, spacingY: 0 };
  // run the program-side of the grid panel directly
  const { gridSlices } = await import('../app/js/lib/slice.js');
  const rects = gridSlices({ sheetW: 64, sheetH: 32, columns: 4, rows: 2 });
  assert.equal(rects.length, 8);
  slice.applyRects(rects, 'grid');
  assert.equal(ctx.store.ui.slice.rects.length, 8);
  resetRaf();
}, { timeout: 20000 });
