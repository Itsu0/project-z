#!/usr/bin/env node

const fs            = require('fs')
const path          = require('path')
const zlib          = require('zlib')
const { execFileSync } = require('child_process')

const ROOT      = path.join(__dirname, '..')
const ELECTRON_DIST = path.join(ROOT, 'node_modules', 'electron', 'dist')
const OUT_DIR   = path.join(ROOT, 'dist-electron')
const APP_DIR   = path.join(ROOT, 'electron')
const ICONS_DIR = path.join(ROOT, 'extension', 'icons')
const OUT_ZIP   = path.join(OUT_DIR, 'Nexus-portable.zip')

function crc32(buf) {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
    table[i] = c
  }
  let crc = 0xFFFFFFFF
  for (const b of buf) crc = table[(crc ^ b) & 0xFF] ^ (crc >>> 8)
  return (crc ^ 0xFFFFFFFF) >>> 0
}

function dosDate(d) { return ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate() }
function dosTime(d) { return (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2) }

function createZip(files) {
  const entries = []
  let offset = 0
  const localHeaders = []

  for (const { name, data } of files) {
    const nameBytes  = Buffer.from(name, 'utf-8')
    const compressed = zlib.deflateRawSync(data, { level: 6 })
    const now        = new Date()
    const crc        = crc32(data)

    const lh = Buffer.allocUnsafe(30 + nameBytes.length)
    lh.writeUInt32LE(0x04034b50, 0)
    lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0, 6); lh.writeUInt16LE(8, 8)
    lh.writeUInt16LE(dosTime(now), 10); lh.writeUInt16LE(dosDate(now), 12)
    lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(compressed.length, 18)
    lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(nameBytes.length, 26)
    lh.writeUInt16LE(0, 28); nameBytes.copy(lh, 30)

    entries.push({ nameBytes, compressed, crc, size: data.length, offset, now })
    localHeaders.push(Buffer.concat([lh, compressed]))
    offset += lh.length + compressed.length
  }

  const centralDir = []
  for (const e of entries) {
    const cd = Buffer.allocUnsafe(46 + e.nameBytes.length)
    cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(20, 4); cd.writeUInt16LE(20, 6)
    cd.writeUInt16LE(0, 8); cd.writeUInt16LE(8, 10)
    cd.writeUInt16LE(dosTime(e.now), 12); cd.writeUInt16LE(dosDate(e.now), 14)
    cd.writeUInt32LE(e.crc, 16); cd.writeUInt32LE(e.compressed.length, 20)
    cd.writeUInt32LE(e.size, 24); cd.writeUInt16LE(e.nameBytes.length, 28)
    cd.writeUInt16LE(0, 30); cd.writeUInt16LE(0, 32); cd.writeUInt16LE(0, 34)
    cd.writeUInt16LE(0, 36); cd.writeUInt32LE(0, 38); cd.writeUInt32LE(e.offset, 42)
    e.nameBytes.copy(cd, 46)
    centralDir.push(cd)
  }

  const cdBuf = Buffer.concat(centralDir)
  const eocd  = Buffer.allocUnsafe(22)
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(0, 4); eocd.writeUInt16LE(0, 6)
  eocd.writeUInt16LE(entries.length, 8); eocd.writeUInt16LE(entries.length, 10)
  eocd.writeUInt32LE(cdBuf.length, 12); eocd.writeUInt32LE(offset, 16); eocd.writeUInt16LE(0, 20)

  return Buffer.concat([...localHeaders, cdBuf, eocd])
}

const zipFiles = []
let fileCount = 0

function addDir(dir, zipPrefix) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full    = path.join(dir, entry.name)
    const zipName = zipPrefix + entry.name
    if (entry.isDirectory()) {
      addDir(full, zipName + '/')
    } else {
      zipFiles.push({ name: zipName, data: fs.readFileSync(full) })
      fileCount++
      if (fileCount % 50 === 0) process.stdout.write(`  ${fileCount} plików...\r`)
    }
  }
}

console.log('📦 Pakowanie Nexus Portable...\n')
fs.mkdirSync(OUT_DIR, { recursive: true })

const srcExe  = path.join(ELECTRON_DIST, 'electron.exe')
const tmpExe  = path.join(OUT_DIR, 'electron-admin.exe')
const embedJs = path.join(__dirname, 'embed-manifest.js')

const osTmpDir = require('os').tmpdir()
const workExe  = path.join(osTmpDir, `nexus-electron-work-${Date.now()}.exe`)

let elevatedExeData = null

try {
  console.log('  → Osadzanie manifestu UAC (requireAdministrator)...')

  const srcData = fs.readFileSync(srcExe)
  fs.writeFileSync(workExe, srcData)
  execFileSync(process.execPath, [embedJs, workExe], { stdio: 'inherit', timeout: 30000 })
  elevatedExeData = fs.readFileSync(workExe)
  console.log('  ✓ Manifest osadzony\n')
} catch (e) {
  console.warn(`  ⚠ Nie udało się osadzić manifestu: ${e.message}`)
  console.warn('    Używam oryginalnego electron.exe (nakładka może nie działać nad grami admin)\n')
  elevatedExeData = fs.readFileSync(srcExe)
} finally {
  try { fs.unlinkSync(workExe) } catch {}
}

console.log('  → Kopiowanie Electron binaries...')
addDir(ELECTRON_DIST, 'Nexus/')

const exeZipIdx = zipFiles.findIndex(f => f.name === 'Nexus/electron.exe')
if (exeZipIdx >= 0) zipFiles[exeZipIdx] = { name: 'Nexus/electron.exe', data: elevatedExeData }
else zipFiles.push({ name: 'Nexus/electron.exe', data: elevatedExeData })

console.log('  → Dodawanie plików aplikacji...')
const appFiles = ['main.js', 'preload.js', 'overlay.html']
for (const f of appFiles) {
  const fp = path.join(APP_DIR, f)
  if (fs.existsSync(fp)) {
    zipFiles.push({ name: `Nexus/resources/app/${f}`, data: fs.readFileSync(fp) })
    fileCount++
  }
}

const pkgJson = JSON.stringify({
  name: 'nexus',
  version: '0.1.0',
  main: 'main.js',
  description: 'Nexus — komunikator głosowy',
  author: 'Nexus Team'
}, null, 2)
zipFiles.push({ name: 'Nexus/resources/app/package.json', data: Buffer.from(pkgJson) })

console.log('  → Dodawanie uiohook-napi...')
const uioSrc = path.join(ROOT, 'node_modules', 'uiohook-napi')
const uioDirs = ['dist', path.join('prebuilds', 'win32-x64')]
for (const rel of uioDirs) {
  const full = path.join(uioSrc, rel)
  if (fs.existsSync(full)) addDir(full, `Nexus/resources/app/node_modules/uiohook-napi/${rel}/`)
}

const uioPkgPath = path.join(uioSrc, 'package.json')
if (fs.existsSync(uioPkgPath)) {
  zipFiles.push({ name: 'Nexus/resources/app/node_modules/uiohook-napi/package.json', data: fs.readFileSync(uioPkgPath) })
  fileCount++
}

const iconFiles = ['icon16.png', 'icon48.png', 'icon128.png', 'icon.ico']
for (const f of iconFiles) {
  const fp = path.join(ICONS_DIR, f)
  if (fs.existsSync(fp)) {
    zipFiles.push({ name: `Nexus/resources/app/icons/${f}`, data: fs.readFileSync(fp) })
  }
}

console.log(`\n  → Tworzenie ZIP (${fileCount} plików)...`)
const zip     = createZip(zipFiles)
fs.writeFileSync(OUT_ZIP, zip)

const sizeMB = (zip.length / 1024 / 1024).toFixed(1)
console.log(`\n✅ Gotowe: dist-electron/Nexus-portable.zip (${sizeMB} MB)`)
console.log(`   Zawiera ${zipFiles.length} plików`)
console.log(`\n📋 Instrukcja dla testerów:`)
console.log(`   1. Wypakuj ZIP do dowolnego folderu`)
console.log(`   2. Uruchom Nexus/electron.exe`)
console.log(`   3. Skrót PTT: RAlt+Z (działa globalnie w grach, obsługuje też przyciski myszy)`)
