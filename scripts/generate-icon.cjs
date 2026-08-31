/**
 * Generates a 256x256 PNG icon for PassMan using only Node.js built-in
 * modules (no external image libraries required).
 *
 * Draws a key shape using a horizontal gradient that mirrors the
 * interactive key-particles background colour scheme:
 *   #3498db (blue) -> #9b59b6 (purple) -> #e91e63 (pink)
 *
 * Output: build/icon.png
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SIZE = 256;
const STROKE = 22;

// Gradient stops (x position 0..1 -> [r, g, b])
const STOPS = [
  [0.0, [52, 152, 219]],   // #3498db
  [0.5, [46, 204, 113]],   // #2ecc71
  [1.0, [46, 125, 79]],    // #2e7d4f
];

function gradientAt(t) {
  for (let i = 0; i < STOPS.length - 1; i++) {
    const [t0, c0] = STOPS[i];
    const [t1, c1] = STOPS[i + 1];
    if (t >= t0 && t <= t1) {
      const f = (t - t0) / (t1 - t0);
      return [
        Math.round(c0[0] + (c1[0] - c0[0]) * f),
        Math.round(c0[1] + (c1[1] - c0[1]) * f),
        Math.round(c0[2] + (c1[2] - c0[2]) * f),
      ];
    }
  }
  return STOPS[STOPS.length - 1][1];
}

// --- Pixel canvas ---
const pixels = Buffer.alloc(SIZE * SIZE * 4); // RGBA, all zeros = transparent

function setPixel(x, y, r, g, b, a) {
  if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) return;
  const idx = (y * SIZE + x) * 4;
  const srcA = a / 255;
  const dstA = pixels[idx + 3] / 255;
  const outA = srcA + dstA * (1 - srcA);
  if (outA === 0) return;
  pixels[idx]     = Math.round((r * srcA + pixels[idx]     * dstA * (1 - srcA)) / outA);
  pixels[idx + 1] = Math.round((g * srcA + pixels[idx + 1] * dstA * (1 - srcA)) / outA);
  pixels[idx + 2] = Math.round((b * srcA + pixels[idx + 2] * dstA * (1 - srcA)) / outA);
  pixels[idx + 3] = Math.round(outA * 255);
}

function distanceToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function drawLine(x1, y1, x2, y2, width) {
  const halfW = width / 2;
  const minX = Math.floor(Math.min(x1, x2) - halfW - 1);
  const maxX = Math.ceil(Math.max(x1, x2) + halfW + 1);
  const minY = Math.floor(Math.min(y1, y2) - halfW - 1);
  const maxY = Math.ceil(Math.max(y1, y2) + halfW + 1);
  for (let y = Math.max(0, minY); y < Math.min(SIZE, maxY + 1); y++) {
    for (let x = Math.max(0, minX); x < Math.min(SIZE, maxX + 1); x++) {
      const d = distanceToSegment(x + 0.5, y + 0.5, x1, y1, x2, y2);
      if (d <= halfW) {
        const t = Math.abs(x2 - x1) > Math.abs(y2 - y1)
          ? (x - x1) / (x2 - x1 || 1)
          : (y - y1) / (y2 - y1 || 1);
        const [r, g, b] = gradientAt(Math.max(0, Math.min(1, t)));
        const aa = Math.min(1, halfW - d + 0.5);
        setPixel(x, y, r, g, b, Math.round(aa * 255));
      }
    }
  }
}

function drawCircle(cx, cy, radius, width) {
  const halfW = width / 2;
  const outerR = radius + halfW;
  const minX = Math.max(0, Math.floor(cx - outerR - 1));
  const maxX = Math.min(SIZE - 1, Math.ceil(cx + outerR + 1));
  const minY = Math.max(0, Math.floor(cy - outerR - 1));
  const maxY = Math.min(SIZE - 1, Math.ceil(cy + outerR + 1));
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      const ringDist = Math.abs(d - radius);
      if (ringDist <= halfW) {
        const t = (x + 0.5) / SIZE;
        const [r, g, b] = gradientAt(t);
        const aa = Math.min(1, halfW - ringDist + 0.5);
        setPixel(x, y, r, g, b, Math.round(aa * 255));
      }
    }
  }
}

// --- Draw the key ---
drawCircle(80, 128, 48, STROKE);
drawLine(128, 128, 220, 128, STROKE);
drawLine(180, 128, 180, 168, STROKE);
drawLine(208, 128, 208, 158, STROKE);

// --- Encode PNG ---
const crcTable = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  crcTable[n] = c;
}
function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = (crcTable[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8));
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; ihdr[9] = 6;

const rowSize = SIZE * 4;
const raw = Buffer.alloc((rowSize + 1) * SIZE);
for (let y = 0; y < SIZE; y++) {
  raw[y * (rowSize + 1)] = 0;
  pixels.copy(raw, y * (rowSize + 1) + 1, y * rowSize, (y + 1) * rowSize);
}
const idat = zlib.deflateSync(raw, { level: 9 });

const png = Buffer.concat([
  sig,
  chunk('IHDR', ihdr),
  chunk('IDAT', idat),
  chunk('IEND', Buffer.alloc(0)),
]);

const outPath = path.join(__dirname, '..', 'build', 'icon.png');
fs.writeFileSync(outPath, png);
console.log(`Icon written to ${outPath} (${png.length} bytes)`);
