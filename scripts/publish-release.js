#!/usr/bin/env node

const { spawnSync } = require('child_process')
const path = require('path')
const os   = require('os')
const fs   = require('fs')

const ROOT     = path.join(__dirname, '..')
const CACHE    = path.join(os.homedir(), 'AppData', 'Local', 'electron-builder', 'Cache', 'winCodeSign')
const SIGN_DIR = path.join(CACHE, 'winCodeSign-2.6.0')
const OUT_DIR  = path.join(os.tmpdir(), 'nexus-dist')
const DEST     = path.join(ROOT, 'dist-electron')

if (!process.env.GH_TOKEN) {
  console.error('❌ Brak zmiennej GH_TOKEN!')
  console.error('')
  console.error('   Ustaw token GitHub przed uruchomieniem:')
  console.error('   PowerShell: $env:GH_TOKEN="ghp_twój_token"')
  console.error('   CMD:        set GH_TOKEN=ghp_twój_token')
  console.error('')
  console.error('   Token wygeneruj na: https://github.com/settings/tokens')
  console.error('   Wymagane uprawnienia: repo (Full control)')
  process.exit(1)
}

if (!fs.existsSync(SIGN_DIR)) {
  if (fs.existsSync(CACHE)) {
    for (const entry of fs.readdirSync(CACHE)) {
      const full = path.join(CACHE, entry)
      if (!entry.endsWith('.7z') && fs.statSync(full).isDirectory()
          && fs.existsSync(path.join(full, 'windows-10'))) {
        console.log('🔧 Naprawiam cache winCodeSign...')
        copyDir(full, SIGN_DIR)
        break
      }
    }
  }
}

if (fs.existsSync(OUT_DIR)) rmDir(OUT_DIR)

console.log('\n🚀 Buduję i publikuję release na GitHub...\n')

const env = {
  ...process.env,
  CSC_IDENTITY_AUTO_DISCOVERY: 'false',
  NODE_TLS_REJECT_UNAUTHORIZED: '0',
}
delete env.WIN_CSC_LINK
delete env.CSC_LINK
delete env.CSC_KEY_PASSWORD

const result = spawnSync(
  process.execPath,
  [
    path.join(ROOT, 'node_modules', 'electron-builder', 'cli.js'),
    '--win', 'nsis', '--x64',
    '--publish', 'always',
    `--config.directories.output=${OUT_DIR}`,
    '--config.npmRebuild=false',
  ],
  { cwd: ROOT, env, stdio: 'inherit' }
)

if (result.status !== 0) {
  console.error('\n❌ Build / publish nie powiódł się')
  process.exit(1)
}

fs.mkdirSync(DEST, { recursive: true })
const exeFiles = fs.readdirSync(OUT_DIR).filter(f => f.endsWith('.exe'))
for (const f of exeFiles) {
  const src = path.join(OUT_DIR, f)
  const dst = path.join(DEST, f)
  fs.copyFileSync(src, dst)
  const sizeMB = (fs.statSync(dst).size / 1024 / 1024).toFixed(0)
  console.log(`\n✅ Lokalny instalator: dist-electron/${f}  (${sizeMB} MB)`)
}
console.log('\n✅ Release opublikowany na GitHub Releases!')
console.log('   https://github.com/Itsu0/nexus/releases')

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name)
    const d = path.join(dst, entry.name)
    if (entry.isDirectory()) copyDir(s, d)
    else if (entry.isFile()) { try { fs.copyFileSync(s, d) } catch {} }
  }
}
function rmDir(p) {
  if (!fs.existsSync(p)) return
  for (const entry of fs.readdirSync(p, { withFileTypes: true })) {
    const full = path.join(p, entry.name)
    if (entry.isDirectory()) rmDir(full)
    else try { fs.unlinkSync(full) } catch {}
  }
  try { fs.rmdirSync(p) } catch {}
}
