// zip.js — minimal, standards-compliant ZIP writer (stored, no compression)
// and reader (stored + deflate via injected inflate). Enough for portable
// .spriteproject archives and PNG-sequence exports.
import { crc32 } from './crc.js';

const DOS_EPOCH = new Date(1980, 0, 1);

function dosDateTime(d = new Date()) {
  const year = Math.max(1980, d.getFullYear());
  return {
    time: ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xffff,
    date: (((year - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xffff,
  };
}

/**
 * Build a ZIP archive (store method, data uncompressed — always valid).
 * entries: [{ name: string, data: Uint8Array, date?: Date }]
 * Returns Uint8Array.
 */
export function zipWrite(entries) {
  const encoder = new TextEncoder();
  const chunks = [];
  const central = [];
  let offset = 0;
  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name.replace(/\\/g, '/'));
    if (nameBytes.length > 0xffff) throw new Error(`ZIP entry name too long: ${entry.name}`);
    const data = entry.data instanceof Uint8Array ? entry.data : new Uint8Array(entry.data);
    const crc = crc32(data);
    const { time, date } = dosDateTime(entry.date || new Date());
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);          // version needed
    local.setUint16(6, 0x0800, true);      // UTF-8 flag
    local.setUint16(8, 0, true);           // method: stored
    local.setUint16(10, time, true);
    local.setUint16(12, date, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, nameBytes.length, true);
    local.setUint16(28, 0, true);          // extra len
    chunks.push(new Uint8Array(local.buffer), nameBytes, data);
    central.push({ nameBytes, crc, size: data.length, offset, time, date });
    offset += 30 + nameBytes.length + data.length;
  }
  const cdStart = offset;
  for (const c of central) {
    const cen = new DataView(new ArrayBuffer(46));
    cen.setUint32(0, 0x02014b50, true);
    cen.setUint16(4, 20, true);
    cen.setUint16(6, 20, true);
    cen.setUint16(8, 0x0800, true);
    cen.setUint16(10, 0, true);
    cen.setUint16(12, c.time, true);
    cen.setUint16(14, c.date, true);
    cen.setUint32(16, c.crc, true);
    cen.setUint32(20, c.size, true);
    cen.setUint32(24, c.size, true);
    cen.setUint16(28, c.nameBytes.length, true);
    cen.setUint32(42, c.offset, true);
    chunks.push(new Uint8Array(cen.buffer), c.nameBytes);
    offset += 46 + c.nameBytes.length;
  }
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, central.length, true);
  end.setUint16(10, central.length, true);
  end.setUint32(12, offset - cdStart, true);
  end.setUint32(16, cdStart, true);
  chunks.push(new Uint8Array(end.buffer));
  const total = chunks.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const c of chunks) { out.set(c, pos); pos += c.length; }
  return out;
}

/** Parse central directory → raw entry pointers (shared by sync/async readers). */
function scanZip(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= 0; i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Invalid ZIP: end-of-central-directory not found (archive damaged?)');
  const count = view.getUint16(eocd + 10, true);
  let ptr = view.getUint32(eocd + 16, true);
  const decoder = new TextDecoder();
  const rawEntries = [];
  for (let i = 0; i < count; i++) {
    if (view.getUint32(ptr, true) !== 0x02014b50) throw new Error(`Invalid ZIP central directory entry #${i}`);
    const method = view.getUint16(ptr + 10, true);
    const crc = view.getUint32(ptr + 16, true);
    const compSize = view.getUint32(ptr + 20, true);
    const size = view.getUint32(ptr + 24, true);
    const nameLen = view.getUint16(ptr + 28, true);
    const extraLen = view.getUint16(ptr + 30, true);
    const commentLen = view.getUint16(ptr + 32, true);
    const localOffset = view.getUint32(ptr + 42, true);
    const name = decoder.decode(bytes.subarray(ptr + 46, ptr + 46 + nameLen));
    if (view.getUint32(localOffset, true) !== 0x04034b50) throw new Error(`Invalid ZIP local header for ${name}`);
    const lNameLen = view.getUint16(localOffset + 26, true);
    const lExtraLen = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + lNameLen + lExtraLen;
    rawEntries.push({ name, method, crc, size, raw: bytes.subarray(dataStart, dataStart + compSize) });
    ptr += 46 + nameLen + extraLen + commentLen;
  }
  return rawEntries;
}

function verify(entry, data) {
  if (data.length !== entry.size) throw new Error(`ZIP entry "${entry.name}" size mismatch (${data.length} != ${entry.size})`);
  if (crc32(data) !== entry.crc) throw new Error(`ZIP entry "${entry.name}" failed CRC check (archive damaged?)`);
  return data;
}

/**
 * Read a ZIP archive. Returns [{ name, data, method }].
 * deflate entries require opts.inflate: (bytes) => Uint8Array
 */
export function zipRead(bytes, { inflate = null } = {}) {
  return scanZip(bytes).map(entry => {
    let data;
    if (entry.method === 0) data = entry.raw.slice();
    else if (entry.method === 8 && inflate) data = inflate(entry.raw);
    else if (entry.method === 8) throw new Error(`ZIP entry "${entry.name}" uses deflate; no inflater provided`);
    else throw new Error(`ZIP entry "${entry.name}" uses unsupported compression method ${entry.method}`);
    return { name: entry.name, data: verify(entry, data), method: entry.method };
  });
}

/** Async variant: deflate entries decompressed via inflateAsync (e.g. DecompressionStream). */
export async function zipReadAsync(bytes, { inflateAsync = null } = {}) {
  const out = [];
  for (const entry of scanZip(bytes)) {
    let data;
    if (entry.method === 0) data = entry.raw.slice();
    else if (entry.method === 8 && inflateAsync) data = await inflateAsync(entry.raw);
    else if (entry.method === 8) throw new Error(`ZIP entry "${entry.name}" uses deflate; no inflater provided`);
    else throw new Error(`ZIP entry "${entry.name}" uses unsupported compression method ${entry.method}`);
    out.push({ name: entry.name, data: verify(entry, data), method: entry.method });
  }
  return out;
}
