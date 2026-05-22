import { Router, Request, Response } from 'express'
import { requireAuth } from '../middleware/auth'

const router = Router()
const TENOR_KEY  = process.env.TENOR_API_KEY ?? ''
const TENOR_BASE = 'https://g.tenor.com/v1'
const COMMON_PARAMS = `key=${TENOR_KEY}&limit=24&media_filter=minimal&contentfilter=medium`

function mapGif(g: any) {
  const gif     = g.media?.[0]?.gif
  const tinygif = g.media?.[0]?.tinygif
  return {
    id:      g.id ?? '',
    title:   g.title ?? '',
    url:     gif?.url ?? '',
    preview: tinygif?.url ?? gif?.url ?? '',
  }
}

router.get('/trending', requireAuth, async (_req: Request, res: Response) => {
  try {
    const r = await fetch(`${TENOR_BASE}/trending?${COMMON_PARAMS}`)
    if (!r.ok) throw new Error(`Tenor ${r.status}`)
    const d = await r.json() as any
    return res.json({ gifs: (d.results ?? []).map(mapGif).filter((g: any) => g.url) })
  } catch (err: any) {
    console.error('[gifs/trending]', err.message)
    return res.status(500).json({ error: 'Błąd pobierania GIF-ów' })
  }
})

router.get('/search', requireAuth, async (req: Request, res: Response) => {
  const q = ((req.query.q as string) ?? '').trim()
  if (!q) return res.json({ gifs: [] })
  try {
    const r = await fetch(`${TENOR_BASE}/search?q=${encodeURIComponent(q)}&${COMMON_PARAMS}`)
    if (!r.ok) throw new Error(`Tenor ${r.status}`)
    const d = await r.json() as any
    return res.json({ gifs: (d.results ?? []).map(mapGif).filter((g: any) => g.url) })
  } catch (err: any) {
    console.error('[gifs/search]', err.message)
    return res.status(500).json({ error: 'Błąd wyszukiwania GIF-ów' })
  }
})

export default router
