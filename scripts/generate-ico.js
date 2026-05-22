#!/usr/bin/env node

const fs   = require('fs')
const path = require('path')
const zlib = require('zlib')

function crc32(buf) {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
    table[i] = c
  }
  let crc = 0xFFFFFFFF
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8)
  return (crc ^ 0xFFFFFFFF) >>> 0
}

function pngChunk(type, data) {
  const len  = Buffer.allocUnsafe(4); len.writeUInt32BE(data.length, 0)
  const tb   = Buffer.from(type, 'ascii')
  const crcb = Buffer.allocUnsafe(4)
  crcb.writeUInt32BE(crc32(Buffer.concat([tb, data])), 0)
  return Buffer.concat([len, tb, data, crcb])
}

function createPNG(size, r, g, b, r2, g2, b2) {
  const sig  = Buffer.from([137,80,78,71,13,10,26,10])
  const ihdr = Buffer.allocUnsafe(13)
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4)
  ihdr[8]=8; ihdr[9]=2; ihdr[10]=0; ihdr[11]=0; ihdr[12]=0
  const raw = Buffer.allocUnsafe(size * (1 + size * 3))
  for (let y = 0; y < size; y++) {
    const off = y * (1 + size * 3)
    raw[off] = 0
    for (let x = 0; x < size; x++) {
      const blend = (y / (size - 1) + x / (size - 1)) / 2
      raw[off + 1 + x*3 + 0] = Math.round(r + (r2 - r) * blend)
      raw[off + 1 + x*3 + 1] = Math.round(g + (g2 - g) * blend)
      raw[off + 1 + x*3 + 2] = Math.round(b + (b2 - b) * blend)
    }
  }
  return Buffer.concat([sig, pngChunk('IHDR', ihdr), pngChunk('IDAT', zlib.deflateSync(raw)), pngChunk('IEND', Buffer.alloc(0))])
}

const iconsDir = path.join(__dirname, '..', 'extension', 'icons')
fs.mkdirSync(iconsDir, { recursive: true })

const sizes = [16, 32, 48, 256]
const pngs  = {}

for (const size of sizes) {
  const filePath = path.join(iconsDir, `icon${size <= 128 ? size : 128}.png`)
  if (fs.existsSync(filePath) && size <= 128) {
    pngs[size] = fs.readFileSync(filePath)
  } else {
    pngs[size] = createPNG(size, 220, 38, 38, 245, 158, 11)
  }
}

function buildICO(images) {

  const count  = images.length
  const headerSize  = 6
  const entrySize   = 16
  const dataOffset  = headerSize + entrySize * count

  const header = Buffer.allocUnsafe(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(count, 4)

  let offset = dataOffset
  const entries = []
  const dataChunks = []

  for (const { size, data } of images) {
    const entry = Buffer.allocUnsafe(16)
    entry[0] = size >= 256 ? 0 : size
    entry[1] = size >= 256 ? 0 : size
    entry[2] = 0
    entry[3] = 0
    entry.writeUInt16LE(1, 4)
    entry.writeUInt16LE(32, 6)
    entry.writeUInt32LE(data.length, 8)
    entry.writeUInt32LE(offset, 12)
    entries.push(entry)
    dataChunks.push(data)
    offset += data.length
  }

  return Buffer.concat([header, ...entries, ...dataChunks])
}

const icoImages = sizes.map(size => ({ size, data: pngs[size] }))
const icoBuf    = buildICO(icoImages)

const outPath = path.join(iconsDir, 'icon.ico')
fs.writeFileSync(outPath, icoBuf)
console.log(`✅ Wygenerowano: extension/icons/icon.ico (${(icoBuf.length / 1024).toFixed(1)} KB)`)
