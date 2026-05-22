

interface CacheEntry {
  data: any[]
  hasMore: boolean
  fetchedAt: number
}

const TTL_MS_FIRST = 30_000
const TTL_MS_PAGED = 120_000
const MAX_ENTRIES  = 500

const cache = new Map<string, CacheEntry>()

export function getCached(channelId: string, before?: string): CacheEntry | null {
  const key   = `${channelId}:${before ?? ''}`
  const entry = cache.get(key)
  if (!entry) return null
  const ttl = before ? TTL_MS_PAGED : TTL_MS_FIRST
  if (Date.now() - entry.fetchedAt > ttl) {
    cache.delete(key)
    return null
  }

  cache.delete(key)
  cache.set(key, entry)
  return entry
}

export function setCached(channelId: string, before: string | undefined, data: any[], hasMore: boolean): void {
  const key = `${channelId}:${before ?? ''}`

  if (cache.size >= MAX_ENTRIES && !cache.has(key)) {
    const oldest = cache.keys().next().value
    if (oldest) cache.delete(oldest)
  }

  cache.set(key, { data, hasMore, fetchedAt: Date.now() })
}

export function invalidateChannel(channelId: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(`${channelId}:`)) cache.delete(key)
  }
}

export function clearAll(): void {
  cache.clear()
}
