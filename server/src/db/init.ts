
import fs   from 'fs'
import path from 'path'
import mysql from 'mysql2/promise'
import dotenv from 'dotenv'

dotenv.config()

function getConnConfig(): mysql.ConnectionOptions {
  const url = process.env.MYSQL_URL ?? process.env.DATABASE_URL
  if (url) {
    const parsed = new URL(url)
    return {
      host:               parsed.hostname,
      port:               Number(parsed.port) || 3306,
      user:               parsed.username,
      password:           parsed.password,

      multipleStatements: true,
    }
  }
  return {
    host:               process.env.DB_HOST     ?? 'localhost',
    port:               Number(process.env.DB_PORT ?? 3306),
    user:               process.env.DB_USER     ?? 'root',
    password:           process.env.DB_PASSWORD ?? '',
    multipleStatements: true,
  }
}

function getDbName(): string {
  const url = process.env.MYSQL_URL ?? process.env.DATABASE_URL
  if (url) return new URL(url).pathname.slice(1)
  return process.env.DB_NAME ?? 'nexus'
}

export async function runMigrations(): Promise<void> {
  const conn = await mysql.createConnection(getConnConfig())
  const dbName = getDbName()

  console.log('🔗 Połączono z MySQL (init)')

  const candidates = [
    path.join(__dirname, 'schema.sql'),
    path.join(__dirname, '..', '..', 'src', 'db', 'schema.sql'),
  ]
  const schemaPath = candidates.find(p => fs.existsSync(p))
  if (!schemaPath) throw new Error('schema.sql nie znaleziony!')

  const sql = fs.readFileSync(schemaPath, 'utf-8')
  await conn.query(sql)

  const migrations: [string, string, string][] = [
    ['tickets',       'screenshot',  'MEDIUMTEXT DEFAULT NULL'],
    ['messages',      'reply_to_id', 'CHAR(36) DEFAULT NULL'],
    ['tickets',       'server_id',   'CHAR(36) DEFAULT NULL'],
    ['user_warnings', 'user_reply',  'TEXT DEFAULT NULL'],
    ['user_warnings', 'reply_at',    'DATETIME DEFAULT NULL'],
    ['users',         'is_dev',      'TINYINT(1) DEFAULT 0'],
    ['polls',         'closed',      'TINYINT(1) DEFAULT 0'],
  ]

  const columnModifications: [string, string, string][] = [

    ['users',   'avatar_url', 'MEDIUMTEXT DEFAULT NULL'],

    ['servers', 'icon_url',   'MEDIUMTEXT DEFAULT NULL'],
  ]
  for (const [table, column, def] of columnModifications) {
    try {
      await conn.query(`ALTER TABLE \`${table}\` MODIFY COLUMN \`${column}\` ${def}`)
      console.log(`   ↳ Zmieniono typ kolumny ${table}.${column}`)
    } catch (e: any) {
      if (e.errno !== 1060) console.warn(`   ⚠ Modyfikacja ${table}.${column}: ${e.message}`)
    }
  }

  for (const [table, column, def] of migrations) {
    try {
      await conn.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${def}`)
      console.log(`   ↳ Dodano kolumnę ${table}.${column}`)
    } catch (e: any) {

      if (e.errno !== 1060) console.warn(`   ⚠ Kolumna ${table}.${column}: ${e.message}`)
    }
  }

  const indexes: [string, string, string][] = [
    ['idx_messages_channel_created', 'messages',       'channel_id, created_at DESC'],
    ['idx_messages_author',          'messages',       'author_id'],
    ['idx_notif_user_unread',        'notifications',  'user_id, read_at'],
    ['idx_notif_created',            'notifications',  'created_at'],
    ['idx_members_user',             'server_members', 'user_id'],
    ['idx_reactions_msg',            'reactions',      'message_id'],
    ['idx_voice_server',             'voice_states',   'server_id'],
    ['idx_channels_server_pos',      'channels',       'server_id, position'],
    ['idx_mutes_user_server',        'server_mutes',   'user_id, server_id'],
    ['idx_polls_message',            'polls',          'message_id'],
    ['idx_poll_options_poll',        'poll_options',   'poll_id'],
  ]

  for (const [idxName, table, cols] of indexes) {
    try {
      await conn.query(`CREATE INDEX \`${idxName}\` ON \`${table}\`(${cols})`)
      console.log(`   ↳ Dodano indeks ${idxName}`)
    } catch (e: any) {
      if (e.errno !== 1061) console.warn(`   ⚠ Indeks ${idxName}: ${e.message}`)
    }
  }

  try {
    await conn.query(`ALTER TABLE \`messages\` ADD FULLTEXT INDEX \`ft_messages_content\` (\`content\`)`)
    console.log('   ↳ Dodano indeks FULLTEXT ft_messages_content')
  } catch (e: any) {
    if (e.errno !== 1061) console.warn('   ⚠ FULLTEXT messages.content:', e.message)
  }

  try {
    const [res] = await conn.query(
      `UPDATE messages m
       INNER JOIN channels c ON c.id = m.channel_id
       SET m.server_id = c.server_id
       WHERE m.server_id IS NULL`
    ) as any[]
    if ((res as any).affectedRows > 0)
      console.log(`   ↳ Uzupełniono server_id w ${(res as any).affectedRows} wiadomościach`)
  } catch (e: any) {
    console.warn('   ⚠ Migracja server_id wiadomości:', e.message)
  }

  try {
    await conn.query(`ALTER TABLE \`messages\` MODIFY COLUMN \`type\` ENUM('DEFAULT','SYSTEM','BOT_EMBED','POLL','POLL_RESULT') DEFAULT 'DEFAULT'`)
    console.log('   ↳ Rozszerzono messages.type ENUM o POLL/POLL_RESULT')
  } catch (e: any) {
    if (e.errno !== 1060) console.warn('   ⚠ Modyfikacja messages.type:', e.message)
  }

  const attachmentPollTablesSql: string[] = [
    `CREATE TABLE IF NOT EXISTS \`message_attachments\` (
      \`id\`           CHAR(36)     NOT NULL,
      \`message_id\`   CHAR(36)     DEFAULT NULL,
      \`channel_id\`   CHAR(36)     NOT NULL,
      \`uploader_id\`  CHAR(36)     NOT NULL,
      \`filename\`     VARCHAR(255) NOT NULL,
      \`content_type\` VARCHAR(128) NOT NULL,
      \`size\`         INT          NOT NULL,
      \`width\`        INT          DEFAULT NULL,
      \`height\`       INT          DEFAULT NULL,
      \`data\`         MEDIUMBLOB   NOT NULL,
      \`created_at\`   DATETIME     DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      INDEX \`idx_att_message\` (\`message_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS \`polls\` (
      \`id\`          CHAR(36)     NOT NULL,
      \`message_id\`  CHAR(36)     DEFAULT NULL,
      \`channel_id\`  CHAR(36)     NOT NULL,
      \`server_id\`   CHAR(36)     NOT NULL,
      \`created_by\`  CHAR(36)     NOT NULL,
      \`question\`    VARCHAR(512) NOT NULL,
      \`multi_choice\` TINYINT(1)  DEFAULT 0,
      \`expires_at\`  DATETIME     DEFAULT NULL,
      \`created_at\`  DATETIME     DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS \`poll_options\` (
      \`id\`       CHAR(36)     NOT NULL,
      \`poll_id\`  CHAR(36)     NOT NULL,
      \`text\`     VARCHAR(256) NOT NULL,
      \`position\` INT          NOT NULL,
      PRIMARY KEY (\`id\`),
      FOREIGN KEY (\`poll_id\`) REFERENCES \`polls\`(\`id\`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS \`poll_votes\` (
      \`poll_option_id\` CHAR(36)  NOT NULL,
      \`user_id\`        CHAR(36)  NOT NULL,
      \`created_at\`     DATETIME  DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`poll_option_id\`, \`user_id\`),
      FOREIGN KEY (\`poll_option_id\`) REFERENCES \`poll_options\`(\`id\`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  ]
  for (const sql of attachmentPollTablesSql) {
    try {
      await conn.query(sql)
      console.log('   ↳ Tabela attachments/polls OK')
    } catch (e: any) {
      console.warn('   ⚠ Tabela attachments/polls:', e.message)
    }
  }

  try {
    await conn.query(`CREATE TABLE IF NOT EXISTS \`server_bans\` (
      \`user_id\`   CHAR(36)     NOT NULL,
      \`server_id\` CHAR(36)     NOT NULL,
      \`banned_by\` CHAR(36)     NOT NULL,
      \`reason\`    VARCHAR(500) DEFAULT NULL,
      \`created_at\` DATETIME    DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`user_id\`, \`server_id\`),
      FOREIGN KEY (\`server_id\`) REFERENCES \`servers\`(\`id\`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`)
    console.log('   ↳ Tabela server_bans OK')
  } catch (e: any) {
    console.warn('   ⚠ Tabela server_bans:', e.message)
  }

  const forumTablesSql: string[] = [
    `CREATE TABLE IF NOT EXISTS \`forum_posts\` (
      \`id\`            CHAR(36)       NOT NULL,
      \`channel_id\`    CHAR(36)       NOT NULL,
      \`server_id\`     CHAR(36)       DEFAULT NULL,
      \`author_id\`     CHAR(36)       NOT NULL,
      \`title\`         VARCHAR(256)   NOT NULL,
      \`content\`       MEDIUMTEXT     NOT NULL,
      \`gif_url\`       VARCHAR(512)   DEFAULT NULL,
      \`pinned\`        TINYINT(1)     DEFAULT 0,
      \`reply_count\`   INT            DEFAULT 0,
      \`last_reply_at\` DATETIME       DEFAULT NULL,
      \`created_at\`    DATETIME       DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      INDEX \`idx_forum_channel\` (\`channel_id\`, \`created_at\` DESC)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS \`forum_replies\` (
      \`id\`         CHAR(36)   NOT NULL,
      \`post_id\`    CHAR(36)   NOT NULL,
      \`author_id\`  CHAR(36)   NOT NULL,
      \`content\`    MEDIUMTEXT NOT NULL,
      \`gif_url\`    VARCHAR(512) DEFAULT NULL,
      \`created_at\` DATETIME   DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      INDEX \`idx_reply_post\` (\`post_id\`, \`created_at\` ASC),
      CONSTRAINT \`fk_reply_post\` FOREIGN KEY (\`post_id\`) REFERENCES \`forum_posts\`(\`id\`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  ]
  for (const sql of forumTablesSql) {
    try {
      await conn.query(sql)
      console.log('   ↳ Tabela forum OK')
    } catch (e: any) {
      console.warn('   ⚠ Tabela forum:', e.message)
    }
  }

  console.log('✅ Migracje zakończone pomyślnie')
  await conn.end()
}

if (require.main === module) {
  runMigrations().catch(err => {
    console.error('❌ Błąd inicjalizacji:', err)
    process.exit(1)
  })
}
