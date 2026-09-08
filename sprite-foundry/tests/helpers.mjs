// helpers.mjs — synthetic deterministic frame construction for tests.
import { createImg, setPx, fillRect, solidImg } from '../app/js/lib/img.js';
import zlib from 'node:zlib';

export const codec = {
  deflateSync: (bytes) => new Uint8Array(zlib.deflateSync(bytes, { level: 9 })),
  inflateSync: (bytes) => new Uint8Array(zlib.inflateSync(bytes)),
  inflateRawSync: (bytes) => new Uint8Array(zlib.inflateRawSync(bytes)),
};

/** A "character" with a colored body that shifts position/size per index — deterministic. */
export function synthFrame(index, w = 32, h = 32, palette = [[200, 40, 40], [40, 90, 200], [240, 200, 60], [40, 180, 90]]) {
  const img = createImg(w, h);
  const [r, g, b] = palette[index % palette.length];
  const bw = 10 + (index % 3) * 2, bh = 14 + (index % 2) * 3;
  const bx = 8 + (index % 4) * 3, by = h - 4 - bh;
  fillRect(img, bx, by, bw, bh, [r, g, b, 255]);            // body
  fillRect(img, bx + 2, by - 5, 6, 5, [r, g, b, 255]);      // head
  fillRect(img, bx + 1, by + bh, 3, 4, [30, 30, 30, 255]);  // legs
  fillRect(img, bx + bw - 4, by + bh, 3, 4, [30, 30, 30, 255]);
  return img;
}

export function imgEquals(a, b) {
  if (a.width !== b.width || a.height !== b.height) return false;
  for (let i = 0; i < a.data.length; i++) if (a.data[i] !== b.data[i]) return false;
  return true;
}

export { createImg, fillRect, solidImg, setPx };
