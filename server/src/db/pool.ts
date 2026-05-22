import mysql from 'mysql2/promise'
import dotenv from 'dotenv'

dotenv.config()

function buildPoolConfig(): mysql.PoolOptions {
  const url = process.env.MYSQL_URL ?? process.env.DATABASE_URL
  if (url) {
    const parsed = new URL(url)
    return {
      host:     parsed.hostname,
      port:     Number(parsed.port) || 3306,
      user:     parsed.username,
      password: parsed.password,

      database: process.env.DB_NAME ?? parsed.pathname.slice(1),
    }
  }
  return {
    host:     process.env.DB_HOST     ?? 'localhost',
    port:     Number(process.env.DB_PORT ?? 3306),
    user:     process.env.DB_USER     ?? 'root',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME     ?? 'nexus',
  }
}

export const pool = mysql.createPool({
  ...buildPoolConfig(),
  waitForConnections: true,
  connectionLimit:    20,
  queueLimit:         0,
  timezone:           '+00:00',
  charset:            'utf8mb4',
})

export async function testConnection(): Promise<void> {
  try {
    const conn = await pool.getConnection()
    console.log('✅ MySQL połączony pomyślnie')
    conn.release()
  } catch (err) {
    console.error('❌ Błąd połączenia z MySQL:', err)
    process.exit(1)
  }
}

export async function queryOne<T>(
  sql: string,
  params: any[] = []
): Promise<T | null> {
  const [rows] = await pool.execute<mysql.RowDataPacket[]>(sql, params)
  return (rows[0] as T) ?? null
}

export async function queryMany<T>(
  sql: string,
  params: any[] = []
): Promise<T[]> {
  const [rows] = await pool.execute<mysql.RowDataPacket[]>(sql, params)
  return rows as T[]
}

export async function execute(
  sql: string,
  params: any[] = []
): Promise<mysql.ResultSetHeader> {
  const [result] = await pool.execute<mysql.ResultSetHeader>(sql, params)
  return result
}
