import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

/**
 * Pure Node.js uncompressed PNG generator (no external dependencies).
 * Creates solid/gradient icons with an academic book icon.
 */
function createPNG(size) {
  const width = size;
  const height = size;

  // Raw RGBA buffer with filter byte at the start of each row
  // row size: 1 (filter byte 0) + width * 4 (RGBA)
  const rawData = Buffer.alloc((1 + width * 4) * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * (1 + width * 4);
    rawData[rowOffset] = 0; // Filter type: None

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;

      // Distance from center for rounded icon effect
      const cx = width / 2;
      const cy = height / 2;
      const r = size * 0.46;
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);

      if (dist <= r) {
        // Gradient from Indigo (#2563eb) to Cyan/Teal (#0284c7)
        const t = y / height;
        const red = Math.round(37 + (2 - 37) * t);
        const green = Math.round(99 + (132 - 99) * t);
        const blue = Math.round(235 + (199 - 235) * t);

        // Simple academic bookmark/pages white shape in center
        const isInBookLeft = (x >= size * 0.28 && x <= size * 0.46 && y >= size * 0.30 && y <= size * 0.70);
        const isInBookRight = (x >= size * 0.54 && x <= size * 0.72 && y >= size * 0.30 && y <= size * 0.70);
        const isInSpine = (x >= size * 0.47 && x <= size * 0.53 && y >= size * 0.32 && y <= size * 0.68);

        if (isInBookLeft || isInBookRight) {
          // White pages
          rawData[pxOffset] = 255;
          rawData[pxOffset + 1] = 255;
          rawData[pxOffset + 2] = 255;
          rawData[pxOffset + 3] = 255;
        } else if (isInSpine) {
          // Spine highlight
          rawData[pxOffset] = 180;
          rawData[pxOffset + 1] = 220;
          rawData[pxOffset + 2] = 255;
          rawData[pxOffset + 3] = 255;
        } else {
          // Gradient background
          rawData[pxOffset] = red;
          rawData[pxOffset + 1] = green;
          rawData[pxOffset + 2] = blue;
          rawData[pxOffset + 3] = 255;
        }
      } else if (dist <= r + 1.2) {
        // Soft anti-aliased edge
        const alpha = Math.max(0, Math.min(255, Math.round((r + 1.2 - dist) * 255)));
        rawData[pxOffset] = 37;
        rawData[pxOffset + 1] = 99;
        rawData[pxOffset + 2] = 235;
        rawData[pxOffset + 3] = alpha;
      } else {
        // Transparent
        rawData[pxOffset] = 0;
        rawData[pxOffset + 1] = 0;
        rawData[pxOffset + 2] = 0;
        rawData[pxOffset + 3] = 0;
      }
    }
  }

  // Compress IDAT
  const compressedData = zlib.deflateSync(rawData);

  // PNG Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR Chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  const ihdrChunk = createChunk('IHDR', ihdr);

  // IDAT Chunk
  const idatChunk = createChunk('IDAT', compressedData);

  // IEND Chunk
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(12 + len);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  const crc = crc32(chunk.subarray(4, 8 + len));
  chunk.writeInt32BE(crc, 8 + len);
  return chunk;
}

// CRC32 table
const crcTable = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xff];
  }
  return crc ^ -1;
}

const assetsDir = path.resolve('assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

[16, 32, 48, 128].forEach(size => {
  const png = createPNG(size);
  fs.writeFileSync(path.join(assetsDir, `icon${size}.png`), png);
  console.log(`Generated icon${size}.png`);
});
