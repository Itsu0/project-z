// ── Współedycja notatek taktycznych (Yjs / CRDT) ─────────────────────────────
// Serwer trzyma Y.Doc per przeciwnik w pamięci, scala aktualizacje od klientów,
// rozgłasza je i okresowo zapisuje stan do bazy. Tekst = Y.Text 'content'.

import * as Y from 'yjs'
import { queryOne, execute } from '../db/pool'

const docs       = new Map<string, Y.Doc>()
const saveTimers = new Map<string, NodeJS.Timeout>()

export async function loadDoc(targetId: string): Promise<Y.Doc> {
  const existing = docs.get(targetId)
  if (existing) return existing
  const doc = new Y.Doc()
  const row = await queryOne<{ doc_state: Buffer | null }>(
    'SELECT doc_state FROM tactics_targets WHERE id = ?', [targetId]
  )
  if (row?.doc_state && row.doc_state.length) {
    try { Y.applyUpdate(doc, new Uint8Array(row.doc_state)) } catch {}
  }
  docs.set(targetId, doc)
  return doc
}

export function encodeState(targetId: string): Uint8Array | null {
  const doc = docs.get(targetId)
  return doc ? Y.encodeStateAsUpdate(doc) : null
}

export function applyClientUpdate(targetId: string, update: Uint8Array, userId: string): void {
  const doc = docs.get(targetId)
  if (!doc) return
  try { Y.applyUpdate(doc, update) } catch { return }
  schedulePersist(targetId, userId)
}

export function getText(targetId: string): string {
  const doc = docs.get(targetId)
  return doc ? doc.getText('content').toString() : ''
}

function schedulePersist(targetId: string, userId: string): void {
  if (saveTimers.has(targetId)) return
  saveTimers.set(targetId, setTimeout(() => { void persist(targetId, userId) }, 3000))
}

export async function persist(targetId: string, userId: string): Promise<void> {
  saveTimers.delete(targetId)
  const doc = docs.get(targetId)
  if (!doc) return
  const state = Buffer.from(Y.encodeStateAsUpdate(doc))
  try {
    await execute('UPDATE tactics_targets SET doc_state = ?, updated_by = ? WHERE id = ?', [state, userId, targetId])
  } catch {}
}

// Zwolnij Y.Doc z pamięci, gdy pokój pusty (po zapisie).
export async function releaseIfEmpty(targetId: string, roomSize: number, userId: string): Promise<void> {
  if (roomSize > 0) return
  await persist(targetId, userId)
  docs.delete(targetId)
}
