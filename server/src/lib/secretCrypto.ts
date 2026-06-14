import crypto from 'crypto'

// Szyfrowanie sekretów wrażliwych (np. sekret TOTP 2FA) w spoczynku — AES-256-GCM.
// Klucz: dedykowany TOTP_ENC_KEY (preferowane; hex 64 znaki lub dowolny ciąg),
// w razie braku — pochodna z JWT_SECRET (SHA-256), aby działało bez dodatkowej konfiguracji.
// UWAGA: po zaszyfrowaniu danych nie zmieniaj źródła klucza — inaczej staną się nieodczytywalne.

function deriveKey(): Buffer {
  const raw = process.env.TOTP_ENC_KEY
  if (raw && raw.length >= 16) {
    if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex')
    return crypto.createHash('sha256').update(raw).digest()
  }
  return crypto.createHash('sha256').update(String(process.env.JWT_SECRET ?? 'pz-fallback-key')).digest()
}

const KEY = deriveKey()
const PREFIX = 'v1'

/** Zaszyfruj jawny sekret → format `v1.<iv>.<tag>.<ciphertext>` (base64). */
export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv)
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [PREFIX, iv.toString('base64'), tag.toString('base64'), ct.toString('base64')].join('.')
}

/** Czy wartość jest w naszym formacie zaszyfrowanym. */
export function isEncrypted(stored: string | null | undefined): boolean {
  return typeof stored === 'string' && stored.startsWith(PREFIX + '.')
}

/** Odszyfruj sekret; wartości w starym formacie (jawne) zwracane bez zmian (zgodność wsteczna). */
export function decryptSecret(stored: string): string {
  if (!isEncrypted(stored)) return stored
  const [, ivB64, tagB64, ctB64] = stored.split('.')
  const iv = Buffer.from(ivB64, 'base64')
  const tag = Buffer.from(tagB64, 'base64')
  const ct = Buffer.from(ctB64, 'base64')
  const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8')
}
