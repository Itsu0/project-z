import { Router, Request, Response } from 'express'
import { requireAuth } from '../middleware/auth'
import { queryOne, execute } from '../db/pool'

const router = Router()

// Upload/aktualizacja własnych kluczy (klient generuje całość lokalnie).
// Serwer przechowuje TYLKO: klucz publiczny (jawny) + zaszyfrowany klucz prywatny
// (odszyfrowywalny wyłącznie frazą odzyskiwania, której serwer nie zna).
router.post('/keys', requireAuth, async (req: Request, res: Response) => {
  try {
    const { publicKey, privateKeyEnc, kdfSalt } = req.body
    if (typeof publicKey !== 'string' || typeof privateKeyEnc !== 'string' || typeof kdfSalt !== 'string') {
      return res.status(400).json({ error: 'Wymagane: publicKey, privateKeyEnc, kdfSalt' })
    }
    if (publicKey.length > 64 || kdfSalt.length > 64 || privateKeyEnc.length > 4096) {
      return res.status(400).json({ error: 'Nieprawidłowe dane kluczy' })
    }
    await execute(
      `INSERT INTO e2e_keys (user_id, public_key, private_key_enc, kdf_salt) VALUES (?,?,?,?)
       ON DUPLICATE KEY UPDATE public_key=VALUES(public_key), private_key_enc=VALUES(private_key_enc), kdf_salt=VALUES(kdf_salt)`,
      [req.user!.userId, publicKey, privateKeyEnc, kdfSalt]
    )
    return res.json({ ok: true })
  } catch (err) {
    console.error('[e2e/keys/post]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

// Mój zaszyfrowany pakiet — do odzyskania klucza prywatnego na nowym urządzeniu.
router.get('/keys/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const row = await queryOne<{ public_key: string; private_key_enc: string; kdf_salt: string }>(
      'SELECT public_key, private_key_enc, kdf_salt FROM e2e_keys WHERE user_id=?', [req.user!.userId]
    )
    return res.json({ keys: row ? { publicKey: row.public_key, privateKeyEnc: row.private_key_enc, kdfSalt: row.kdf_salt } : null })
  } catch (err) {
    console.error('[e2e/keys/me]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

// Czy mam już skonfigurowane klucze.
router.get('/keys/status', requireAuth, async (req: Request, res: Response) => {
  try {
    const row = await queryOne<{ user_id: string }>('SELECT user_id FROM e2e_keys WHERE user_id=?', [req.user!.userId])
    return res.json({ hasKeys: !!row })
  } catch (err) {
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

// Klucz publiczny innego użytkownika (do wyprowadzenia wspólnego sekretu).
router.get('/keys/:userId', requireAuth, async (req: Request, res: Response) => {
  try {
    const row = await queryOne<{ public_key: string }>('SELECT public_key FROM e2e_keys WHERE user_id=?', [req.params.userId])
    if (!row) return res.status(404).json({ error: 'Użytkownik nie ma kluczy E2E' })
    return res.json({ userId: req.params.userId, publicKey: row.public_key })
  } catch (err) {
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

export default router
