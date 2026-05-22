#!/usr/bin/env node

const fs   = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[i] = c;
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function pngChunk(type, data) {
  const len  = Buffer.allocUnsafe(4); len.writeUInt32BE(data.length, 0);
  const tb   = Buffer.from(type, 'ascii');
  const crcb = Buffer.allocUnsafe(4);
  crcb.writeUInt32BE(crc32(Buffer.concat([tb, data])), 0);
  return Buffer.concat([len, tb, data, crcb]);
}

function createSolidPNG(size, r, g, b, r2, g2, b2) {

  const sig  = Buffer.from([137,80,78,71,13,10,26,10]);
  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8]=8; ihdr[9]=2; ihdr[10]=0; ihdr[11]=0; ihdr[12]=0;

  const raw = Buffer.allocUnsafe(size * (1 + size * 3));
  for (let y = 0; y < size; y++) {
    const off = y * (1 + size * 3);
    raw[off] = 0;
    const t = r2 !== undefined ? y / (size - 1) : 0;
    for (let x = 0; x < size; x++) {
      const xt = r2 !== undefined ? x / (size - 1) : 0;
      const blend = (t + xt) / 2;
      raw[off + 1 + x*3 + 0] = Math.round(r + (r2 - r) * blend);
      raw[off + 1 + x*3 + 1] = Math.round(g + (g2 - g) * blend);
      raw[off + 1 + x*3 + 2] = Math.round(b + (b2 - b) * blend);
    }
  }
  const compressed = zlib.deflateSync(raw);
  return Buffer.concat([sig, pngChunk('IHDR', ihdr), pngChunk('IDAT', compressed), pngChunk('IEND', Buffer.alloc(0))]);
}

function makeIcon(size)       { return createSolidPNG(size, 220,38,38, 245,158,11); }

function makeActiveIcon(size) { return createSolidPNG(size, 220,38,38, 185,20,20); }

const iconsDir = path.join(__dirname, '..', 'extension', 'icons');
fs.mkdirSync(iconsDir, { recursive: true });

for (const size of [16, 48, 128]) {
  fs.writeFileSync(path.join(iconsDir, `icon${size}.png`),   makeIcon(size));
  fs.writeFileSync(path.join(iconsDir, `active${size}.png`), makeActiveIcon(size));
  console.log(`  ✓ Ikony ${size}px`);
}

function deflate(data) {
  return zlib.deflateRawSync(data, { level: 6 });
}

function dosDate(d) {
  return ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
}
function dosTime(d) {
  return (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2);
}

function createZip(files) {

  const entries = [];
  let offset = 0;

  const localHeaders = [];
  for (const { name, data } of files) {
    const nameBytes    = Buffer.from(name, 'utf-8');
    const compressed   = deflate(data);
    const now          = new Date();
    const crc          = crc32(data);

    const lh = Buffer.allocUnsafe(30 + nameBytes.length);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);
    lh.writeUInt16LE(0, 6);
    lh.writeUInt16LE(8, 8);
    lh.writeUInt16LE(dosTime(now), 10);
    lh.writeUInt16LE(dosDate(now), 12);
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(compressed.length, 18);
    lh.writeUInt32LE(data.length, 22);
    lh.writeUInt16LE(nameBytes.length, 26);
    lh.writeUInt16LE(0, 28);
    nameBytes.copy(lh, 30);

    entries.push({ nameBytes, compressed, crc, size: data.length, offset, now });
    localHeaders.push(Buffer.concat([lh, compressed]));
    offset += lh.length + compressed.length;
  }

  const centralDir = [];
  for (const e of entries) {
    const cd = Buffer.allocUnsafe(46 + e.nameBytes.length);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0, 8);
    cd.writeUInt16LE(8, 10);
    cd.writeUInt16LE(dosTime(e.now), 12);
    cd.writeUInt16LE(dosDate(e.now), 14);
    cd.writeUInt32LE(e.crc, 16);
    cd.writeUInt32LE(e.compressed.length, 20);
    cd.writeUInt32LE(e.size, 24);
    cd.writeUInt16LE(e.nameBytes.length, 28);
    cd.writeUInt16LE(0, 30); cd.writeUInt16LE(0, 32);
    cd.writeUInt16LE(0, 34); cd.writeUInt16LE(0, 36);
    cd.writeUInt32LE(0, 38);
    cd.writeUInt32LE(e.offset, 42);
    e.nameBytes.copy(cd, 46);
    centralDir.push(cd);
  }

  const cdBuf   = Buffer.concat(centralDir);
  const eocd    = Buffer.allocUnsafe(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4); eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cdBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localHeaders, cdBuf, eocd]);
}

const extDir = path.join(__dirname, '..', 'extension');
const zipFiles = [];

function addDir(dir, prefix = '') {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const zip  = prefix + entry.name;
    if (entry.isDirectory()) {
      addDir(full, zip + '/');
    } else {
      zipFiles.push({ name: zip, data: fs.readFileSync(full) });
    }
  }
}

addDir(extDir);

const zip = createZip(zipFiles);
const publicDir = path.join(__dirname, '..', 'public');
fs.mkdirSync(publicDir, { recursive: true });
fs.writeFileSync(path.join(publicDir, 'nexus-ptt.zip'), zip);

console.log(`\n✅ Rozszerzenie zbudowane: public/nexus-ptt.zip (${(zip.length / 1024).toFixed(1)} KB)`);
console.log(`   Zawiera ${zipFiles.length} plików`);
