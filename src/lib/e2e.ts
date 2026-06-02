// ── E2E (szyfrowanie end-to-end DM) ──────────────────────────────────────────
// X25519 (nacl.box) do wymiany kluczy + szyfrowania wiadomości,
// klucz prywatny chroniony kodem odzyskiwania (PBKDF2 + secretbox).
// Serwer nigdy nie widzi: kodu odzyskiwania, klucza prywatnego ani treści.

import nacl from 'tweetnacl'

// ── helpery base64 / utf8 (przeglądarka) ──
const b64 = {
  enc: (u: Uint8Array) => btoa(String.fromCharCode(...u)),
  dec: (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0)),
}
const utf8 = {
  enc: (s: string) => new TextEncoder().encode(s),
  dec: (u: Uint8Array) => new TextDecoder().decode(u),
}

export interface Identity { publicKey: Uint8Array; secretKey: Uint8Array }

export function generateIdentity(): Identity {
  const kp = nacl.box.keyPair()
  return { publicKey: kp.publicKey, secretKey: kp.secretKey }
}

export function publicKeyB64(id: Identity): string {
  return b64.enc(id.publicKey)
}

// ── Kod odzyskiwania: 20 losowych bajtów → base32 (Crockford, 32 znaki) ──
const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ' // Crockford: bez I,L,O,U (32 znaki, indeksy 0-31)
export function generateRecoveryCode(): string {
  const bytes = nacl.randomBytes(20) // 160 bitów entropii
  let bits = 0, val = 0, out = ''
  for (const byte of bytes) {
    val = (val << 8) | byte; bits += 8
    while (bits >= 5) { out += B32[(val >>> (bits - 5)) & 31]; bits -= 5 }
  }
  if (bits > 0) out += B32[(val << (5 - bits)) & 31]
  return out.match(/.{1,4}/g)!.join('-')
}

function normalizeCode(code: string): string {
  return code.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
}

export function randomSalt(): string {
  return b64.enc(nacl.randomBytes(16))
}

// ── PBKDF2: kod odzyskiwania + sól → 32-bajtowy klucz (Web Crypto) ──
export async function deriveKey(recoveryCode: string, saltB64: string): Promise<Uint8Array> {
  const material = await crypto.subtle.importKey(
    'raw', utf8.enc(normalizeCode(recoveryCode)), 'PBKDF2', false, ['deriveBits']
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: b64.dec(saltB64), iterations: 200_000, hash: 'SHA-256' },
    material, 256
  )
  return new Uint8Array(bits)
}

// ── Klucz prywatny zaszyfrowany kluczem z kodu (secretbox) ──
export function sealSecretKey(secretKey: Uint8Array, derivedKey: Uint8Array): string {
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength)
  const box = nacl.secretbox(secretKey, nonce, derivedKey)
  const out = new Uint8Array(nonce.length + box.length)
  out.set(nonce); out.set(box, nonce.length)
  return b64.enc(out)
}
export function openSecretKey(blobB64: string, derivedKey: Uint8Array): Uint8Array | null {
  try {
    const data = b64.dec(blobB64)
    const nonce = data.slice(0, nacl.secretbox.nonceLength)
    const box = data.slice(nacl.secretbox.nonceLength)
    return nacl.secretbox.open(box, nonce, derivedKey) ?? null
  } catch { return null }
}

// ── Szyfrowanie wiadomości (nacl.box: mój klucz prywatny + ich publiczny) ──
export function encryptMessage(plaintext: string, theirPubB64: string, mySecret: Uint8Array): string {
  const nonce = nacl.randomBytes(nacl.box.nonceLength)
  const box = nacl.box(utf8.enc(plaintext), nonce, b64.dec(theirPubB64), mySecret)
  const out = new Uint8Array(nonce.length + box.length)
  out.set(nonce); out.set(box, nonce.length)
  return b64.enc(out)
}
export function decryptMessage(blobB64: string, theirPubB64: string, mySecret: Uint8Array): string | null {
  try {
    const data = b64.dec(blobB64)
    const nonce = data.slice(0, nacl.box.nonceLength)
    const box = data.slice(nacl.box.nonceLength)
    const pt = nacl.box.open(box, nonce, b64.dec(theirPubB64), mySecret)
    return pt ? utf8.dec(pt) : null
  } catch { return null }
}

// ── Sesyjny magazyn klucza prywatnego (pamięć + sessionStorage) ──
const SS_KEY = 'pz_e2e_sk'
let sessionSecret: Uint8Array | null = null

export function setSessionSecret(sk: Uint8Array) {
  sessionSecret = sk
  try { sessionStorage.setItem(SS_KEY, b64.enc(sk)) } catch {}
}
export function getSessionSecret(): Uint8Array | null {
  if (sessionSecret) return sessionSecret
  try {
    const s = sessionStorage.getItem(SS_KEY)
    if (s) { sessionSecret = b64.dec(s); return sessionSecret }
  } catch {}
  return null
}
export function clearSessionSecret() {
  sessionSecret = null
  try { sessionStorage.removeItem(SS_KEY) } catch {}
}
