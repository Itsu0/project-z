import express from 'express'
import { createServer } from 'http'
import { Server as SocketIO } from 'socket.io'
import cors from 'cors'
import compression from 'compression'
import rateLimit from 'express-rate-limit'
import dotenv from 'dotenv'

import { testConnection } from './db/pool'
import { runMigrations, startDmCron } from './db/init'
import { setupSocket } from './socket'

import authRoutes          from './routes/auth'
import serverRoutes        from './routes/servers'
import messageRoutes       from './routes/messages'
import livekitRoutes       from './routes/livekit'
import settingsRoutes      from './routes/settings'
import moderationRoutes    from './routes/moderation'
import notificationsRoutes from './routes/notifications'
import userSettingsRoutes  from './routes/userSettings'
import ticketsRoutes       from './routes/tickets'
import adminRoutes         from './routes/admin'
import forumRoutes         from './routes/forum'
import gifsRoutes          from './routes/gifs'
import attachmentsRoutes   from './routes/attachments'
import pollsRoutes, { restorePollTimers } from './routes/polls'
import serverModRoutes from './routes/serverMod'
import friendsRoutes from './routes/friends'
import dmRoutes from './routes/dm'
import billingRoutes from './routes/billing'
import e2eRoutes from './routes/e2e'

dotenv.config()

const app        = express()
const httpServer = createServer(app)
const PORT       = Number(process.env.PORT ?? 3001)
const FRONTEND   = process.env.FRONTEND_URL ?? 'http://localhost:3000'

app.set('trust proxy', 1)
app.disable('x-powered-by')

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true
  if (origin === FRONTEND) return true
  if (origin.startsWith('http://localhost:')) return true
  const extra = (process.env.ALLOWED_ORIGINS ?? '').split(',').map(s => s.trim()).filter(Boolean)
  return extra.includes(origin)
}

app.use((_req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff')
  res.set('X-Frame-Options', 'DENY')
  res.set('X-XSS-Protection', '1; mode=block')
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  res.set('X-Download-Options', 'noopen')
  res.set('X-Permitted-Cross-Domain-Policies', 'none')
  res.set('Cross-Origin-Resource-Policy', 'same-origin')
  res.set('Cross-Origin-Opener-Policy', 'same-origin')
  if (process.env.NODE_ENV === 'production') {
    res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
  }
  next()
})

app.use(cors({
  origin:      (origin, cb) => cb(null, isAllowedOrigin(origin)),
  credentials: true,
  methods:     ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
}))

app.use(compression({
  level: 6,
  threshold: 1024,
  filter: (req: express.Request, res: express.Response) => {

    if (req.headers['x-no-compression']) return false
    return compression.filter(req, res)
  },
}))

const globalLimiter = rateLimit({
  windowMs:         60 * 1000,
  max:              500,
  standardHeaders:  true,
  legacyHeaders:    false,
  message:          { error: 'Zbyt wiele zapytań, poczekaj chwilę' },
  skip: (req) => req.path === '/health',
})

const authLimiter = rateLimit({
  windowMs:  15 * 60 * 1000,
  max:       50,
  message:   { error: 'Zbyt wiele prób logowania, spróbuj za 15 minut' },
  standardHeaders: true,
  legacyHeaders:   false,
  // Pomijaj endpointy read-only wymagające ważnego tokenu (nie są wektorem brute-force,
  // a /me jest wołane przy każdym ładowaniu/reconnekcie aplikacji).
  skip: (req) => req.path.endsWith('/me') || req.path.endsWith('/status') || req.path.endsWith('/settings'),
})

const messageLimiter = rateLimit({
  windowMs:  10 * 1000,
  max:       30,
  message:   { error: 'Wysyłasz za dużo wiadomości' },
  standardHeaders: true,
  legacyHeaders:   false,
})

const socketioLimiter = rateLimit({
  windowMs:        60 * 1000,
  max:             60,
  message:         { error: 'Zbyt wiele połączeń, poczekaj chwilę' },
  standardHeaders: false,
  legacyHeaders:   false,
})

app.use(globalLimiter)
app.use('/socket.io', socketioLimiter)
app.use('/api/livekit/webhook', express.raw({ type: '*/*' }))
app.use('/api/billing/webhook', express.raw({ type: '*/*' }))
app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ extended: true }))

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? './uploads'
const staticOpts = (extra?: Record<string, string>) => ({
  maxAge: '1y',
  immutable: true,
  setHeaders: (res: express.Response) => {
    res.set('Cross-Origin-Resource-Policy', 'cross-origin')
    res.set('Cache-Control', 'public, max-age=31536000, immutable')
    if (extra) Object.entries(extra).forEach(([k, v]) => res.set(k, v))
  },
})
app.use('/uploads/avatars',      express.static(UPLOAD_DIR + '/avatars',      staticOpts()))
app.use('/uploads/icons',        express.static(UPLOAD_DIR + '/icons',        staticOpts()))
app.use('/uploads/attachments',  express.static(UPLOAD_DIR + '/attachments',  staticOpts()))

app.use('/api/auth',          authLimiter, authRoutes)
app.use('/api/channels',      messageLimiter, messageRoutes)
app.use('/api/servers',       serverRoutes)
app.use('/api/servers',       settingsRoutes)
app.use('/api/servers',       moderationRoutes)
app.use('/api/livekit',       livekitRoutes)
app.use('/api/notifications', notificationsRoutes)
app.use('/api/user',          userSettingsRoutes)
app.use('/api/tickets',       ticketsRoutes)
app.use('/api/admin',         adminRoutes)
app.use('/api/forum',         messageLimiter, forumRoutes)
app.use('/api/gifs',          gifsRoutes)
app.use('/api/channels',      attachmentsRoutes)
app.use('/api/attachments',   attachmentsRoutes)
app.use('/api/channels',      pollsRoutes)
app.use('/api/polls',         pollsRoutes)
app.use('/api/servers',       serverModRoutes)
app.use('/api/friends',       friendsRoutes)
app.use('/api/dm',            messageLimiter, dmRoutes)
app.use('/api/billing',       billingRoutes)
app.use('/api/e2e',           e2eRoutes)

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() })
})

app.use((_req, res) => {
  res.status(404).json({ error: 'Endpoint nie znaleziony' })
})

const io = new SocketIO(httpServer, {
  cors: {
    origin:      (origin, cb) => cb(null, isAllowedOrigin(origin)),
    credentials: true,
    methods:     ['GET', 'POST'],
  },
  transports:   ['websocket', 'polling'],
  pingTimeout:  15000,
  pingInterval: 10000,

  perMessageDeflate: {
    threshold: 1024,
  },
  maxHttpBufferSize: 1e6,
})

setupSocket(io)

async function start() {
  httpServer.timeout = 30000
  await new Promise<void>(resolve => {
    httpServer.listen(PORT, () => {
      console.log(`🚀 Nexus Backend nasłuchuje na porcie ${PORT}`)
      resolve()
    })
  })

  try {
    await testConnection()
    await runMigrations()
    await restorePollTimers()
    startDmCron()
    console.log('')
    console.log('✅ Baza danych gotowa')
    console.log(`   REST API:  http://localhost:${PORT}/api`)
    console.log(`   Socket.io: ws://localhost:${PORT}`)
    console.log(`   Frontend:  ${FRONTEND}`)
    console.log(`   Kompresja: ✅ gzip poziom 6`)
    console.log(`   Rate limit: ✅ 200 req/min global`)
    console.log('')
  } catch (err) {
    console.error('❌ Błąd inicjalizacji bazy:', err)
    process.exit(1)
  }
}

start().catch(err => {
  console.error('❌ Błąd startu:', err)
  process.exit(1)
})

export { io }
