-- ============================================================
--  NEXUS — Schemat bazy danych MySQL
--  Uruchom: mysql -u root -p nexus < schema.sql
--  Lub przez: npm run db:init
-- ============================================================

CREATE DATABASE IF NOT EXISTS nexus
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE nexus;

-- ─── Użytkownicy ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            CHAR(36)      PRIMARY KEY,
  username      VARCHAR(32)   UNIQUE NOT NULL,
  display_name  VARCHAR(32)   NOT NULL,
  email         VARCHAR(254)  UNIQUE NOT NULL,
  password_hash VARCHAR(255)  NOT NULL,
  avatar_url    MEDIUMTEXT    DEFAULT NULL,
  avatar_color  VARCHAR(120)  DEFAULT 'linear-gradient(135deg,#64748b,#475569)',
  status        ENUM('online','idle','dnd','offline') DEFAULT 'offline',
  custom_status VARCHAR(128)  DEFAULT NULL,
  is_dev        TINYINT(1)    DEFAULT 0,
  is_mod        TINYINT(1)    DEFAULT 0,
  last_ip       VARCHAR(45)   DEFAULT NULL,
  created_at    DATETIME      DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email    (email),
  INDEX idx_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── Serwery ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS servers (
  id            CHAR(36)      PRIMARY KEY,
  name          VARCHAR(100)  NOT NULL,
  icon_url      MEDIUMTEXT    DEFAULT NULL,
  icon_color    VARCHAR(120)  DEFAULT 'linear-gradient(135deg,#dc2626,#f59e0b)',
  description   TEXT          DEFAULT NULL,
  owner_id      CHAR(36)      NOT NULL,
  plan          ENUM('free','standard','pro') DEFAULT 'free',
  expires_at    DATETIME      DEFAULT NULL,
  member_limit  INT           DEFAULT 10,
  invite_code   VARCHAR(12)   UNIQUE NOT NULL,
  created_at    DATETIME      DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_invite (invite_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── Role ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS roles (
  id            CHAR(36)      PRIMARY KEY,
  server_id     CHAR(36)      NOT NULL,
  name          VARCHAR(64)   NOT NULL,
  color         VARCHAR(7)    DEFAULT '#a8a9af',
  permissions   JSON          NOT NULL DEFAULT (JSON_ARRAY()),
  position      INT           DEFAULT 0,
  hoist         TINYINT(1)    DEFAULT 0,
  mentionable   TINYINT(1)    DEFAULT 0,
  created_at    DATETIME      DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
  INDEX idx_server (server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── Członkowie serwera ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS server_members (
  user_id       CHAR(36)      NOT NULL,
  server_id     CHAR(36)      NOT NULL,
  nickname      VARCHAR(32)   DEFAULT NULL,
  joined_at     DATETIME      DEFAULT CURRENT_TIMESTAMP,
  boosting      TINYINT(1)    DEFAULT 0,
  PRIMARY KEY (user_id, server_id),
  FOREIGN KEY (user_id)   REFERENCES users(id)   ON DELETE CASCADE,
  FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── Role użytkowników ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS member_roles (
  user_id       CHAR(36)      NOT NULL,
  server_id     CHAR(36)      NOT NULL,
  role_id       CHAR(36)      NOT NULL,
  PRIMARY KEY (user_id, server_id, role_id),
  FOREIGN KEY (user_id,   server_id) REFERENCES server_members(user_id, server_id) ON DELETE CASCADE,
  FOREIGN KEY (role_id)              REFERENCES roles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── Kategorie kanałów ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS channel_categories (
  id            CHAR(36)      PRIMARY KEY,
  server_id     CHAR(36)      NOT NULL,
  name          VARCHAR(64)   NOT NULL,
  position      INT           DEFAULT 0,
  FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
  INDEX idx_server (server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── Kanały ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS channels (
  id            CHAR(36)      PRIMARY KEY,
  server_id     CHAR(36)      NOT NULL,
  category_id   CHAR(36)      DEFAULT NULL,
  type          ENUM('text','voice','announcement','forum','stage') DEFAULT 'text',
  name          VARCHAR(64)   NOT NULL,
  topic         VARCHAR(1024) DEFAULT NULL,
  position      INT           DEFAULT 0,
  nsfw          TINYINT(1)    DEFAULT 0,
  slowmode      INT           DEFAULT 0,
  bitrate       INT           DEFAULT 64000,
  user_limit    INT           DEFAULT 0,
  last_message_id CHAR(36)    DEFAULT NULL,
  created_at    DATETIME      DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (server_id)   REFERENCES servers(id)            ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES channel_categories(id) ON DELETE SET NULL,
  INDEX idx_server   (server_id),
  INDEX idx_category (category_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── Wiadomości ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id            CHAR(36)      PRIMARY KEY,
  channel_id    CHAR(36)      NOT NULL,
  server_id     CHAR(36)      NOT NULL,
  author_id     CHAR(36)      NOT NULL,
  reply_to_id   CHAR(36)      DEFAULT NULL,
  content       TEXT          NOT NULL,
  type          ENUM('DEFAULT','SYSTEM','BOT_EMBED') DEFAULT 'DEFAULT',
  is_admin_msg  TINYINT(1)    DEFAULT 0,
  pinned        TINYINT(1)    DEFAULT 0,
  edited_at     DATETIME      DEFAULT NULL,
  created_at    DATETIME      DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
  FOREIGN KEY (server_id)  REFERENCES servers(id)  ON DELETE CASCADE,
  FOREIGN KEY (author_id)  REFERENCES users(id)    ON DELETE CASCADE,
  INDEX idx_channel_created (channel_id, created_at DESC),
  INDEX idx_author           (author_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── Załączniki ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS attachments (
  id            CHAR(36)      PRIMARY KEY,
  message_id    CHAR(36)      NOT NULL,
  filename      VARCHAR(255)  NOT NULL,
  url           VARCHAR(512)  NOT NULL,
  content_type  VARCHAR(100)  DEFAULT NULL,
  size          INT           DEFAULT 0,
  width         INT           DEFAULT NULL,
  height        INT           DEFAULT NULL,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── Reakcje ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reactions (
  message_id    CHAR(36)      NOT NULL,
  user_id       CHAR(36)      NOT NULL,
  emoji         VARCHAR(64)   NOT NULL,
  created_at    DATETIME      DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (message_id, user_id, emoji),
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── Niestandardowe emoji ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS custom_emoji (
  id            CHAR(36)      PRIMARY KEY,
  server_id     CHAR(36)      NOT NULL,
  name          VARCHAR(32)   NOT NULL,
  url           VARCHAR(512)  NOT NULL,
  animated      TINYINT(1)    DEFAULT 0,
  uploaded_by   CHAR(36)      NOT NULL,
  created_at    DATETIME      DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (server_id)   REFERENCES servers(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(id)   ON DELETE CASCADE,
  UNIQUE KEY unique_emoji_name (server_id, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── Odczytanie kanałów (unread tracking) ────────────────────
CREATE TABLE IF NOT EXISTS channel_reads (
  user_id         CHAR(36)    NOT NULL,
  channel_id      CHAR(36)    NOT NULL,
  last_read_id    CHAR(36)    DEFAULT NULL,
  last_read_at    DATETIME    DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, channel_id),
  FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE,
  FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── Ustawienia użytkownika ──────────────────────────────────
CREATE TABLE IF NOT EXISTS user_settings (
  user_id     CHAR(36)  PRIMARY KEY,
  settings    JSON      NOT NULL DEFAULT ('{}'),
  updated_at  DATETIME  DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── Stany kanałów głosowych ────────────────────────────────
CREATE TABLE IF NOT EXISTS voice_states (
  user_id     CHAR(36)  NOT NULL,
  channel_id  CHAR(36)  NOT NULL,
  server_id   CHAR(36)  NOT NULL,
  joined_at   DATETIME  DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE,
  FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
  FOREIGN KEY (server_id)  REFERENCES servers(id)  ON DELETE CASCADE,
  INDEX idx_channel (channel_id),
  INDEX idx_server  (server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── Wyciszenia na serwerze ──────────────────────────────────
CREATE TABLE IF NOT EXISTS server_mutes (
  user_id     CHAR(36)      NOT NULL,
  server_id   CHAR(36)      NOT NULL,
  muted_by    CHAR(36)      NOT NULL,
  reason      VARCHAR(500)  DEFAULT NULL,
  expires_at  DATETIME      NOT NULL,
  created_at  DATETIME      DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, server_id),
  FOREIGN KEY (user_id)   REFERENCES users(id)   ON DELETE CASCADE,
  FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
  FOREIGN KEY (muted_by)  REFERENCES users(id)   ON DELETE CASCADE,
  INDEX idx_server  (server_id),
  INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── Powiadomienia ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id          CHAR(36)    PRIMARY KEY,
  user_id     CHAR(36)    NOT NULL,
  server_id   CHAR(36)    DEFAULT NULL,
  channel_id  CHAR(36)    DEFAULT NULL,
  message_id  CHAR(36)    DEFAULT NULL,
  type        VARCHAR(32) NOT NULL DEFAULT 'mention',
  read_at     DATETIME    DEFAULT NULL,
  created_at  DATETIME    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_unread (user_id, read_at),
  INDEX idx_channel     (channel_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── Zgłoszenia (tickets) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS tickets (
  id           CHAR(36)     PRIMARY KEY,
  user_id      CHAR(36)     NOT NULL,
  category     ENUM('bug','abuse','security','spam','other') NOT NULL DEFAULT 'other',
  subject      VARCHAR(200) NOT NULL,
  description  TEXT         NOT NULL,
  status       ENUM('open','in_progress','resolved','closed') NOT NULL DEFAULT 'open',
  admin_reply  TEXT         DEFAULT NULL,
  server_id    CHAR(36)     DEFAULT NULL,
  channel_id   CHAR(36)     DEFAULT NULL,
  message_id   CHAR(36)     DEFAULT NULL,
  screenshot   MEDIUMTEXT   DEFAULT NULL,
  created_at   DATETIME     DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id)   REFERENCES users(id)   ON DELETE CASCADE,
  FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE SET NULL,
  INDEX idx_user   (user_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── Bany kont ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_bans (
  id          CHAR(36)      PRIMARY KEY,
  user_id     CHAR(36)      NOT NULL,
  banned_by   CHAR(36)      NOT NULL,
  reason      VARCHAR(500)  NOT NULL,
  expires_at  DATETIME      DEFAULT NULL,
  created_at  DATETIME      DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id)   REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (banned_by) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user    (user_id),
  INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── Historia IP użytkowników ────────────────────────────────
CREATE TABLE IF NOT EXISTS user_ips (
  id         CHAR(36)     PRIMARY KEY,
  user_id    CHAR(36)     NOT NULL,
  ip         VARCHAR(45)  NOT NULL,
  first_seen DATETIME     DEFAULT CURRENT_TIMESTAMP,
  last_seen  DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_user_ip (user_id, ip),
  INDEX idx_ip (ip)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── Zablokowane adresy IP ───────────────────────────────────
CREATE TABLE IF NOT EXISTS banned_ips (
  id         CHAR(36)     PRIMARY KEY,
  ip         VARCHAR(45)  NOT NULL UNIQUE,
  reason     VARCHAR(500) NOT NULL,
  banned_by  CHAR(36)     NOT NULL,
  created_at DATETIME     DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (banned_by) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_ip (ip)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── Ostrzeżenia ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_warnings (
  id          CHAR(36)      PRIMARY KEY,
  user_id     CHAR(36)      NOT NULL,
  warned_by   CHAR(36)      NOT NULL,
  reason      VARCHAR(500)  NOT NULL,
  seen_at     DATETIME      DEFAULT NULL,
  user_reply  TEXT          DEFAULT NULL,
  reply_at    DATETIME      DEFAULT NULL,
  created_at  DATETIME      DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id)   REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (warned_by) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── Ustawienia moderacji serwera ───────────────────────────
CREATE TABLE IF NOT EXISTS server_mod_settings (
  server_id              CHAR(36)     PRIMARY KEY,
  mod_log_channel_id     CHAR(36)     DEFAULT NULL,
  automod_enabled        TINYINT(1)   DEFAULT 0,
  raid_protection        TINYINT(1)   DEFAULT 0,
  raid_threshold         INT          DEFAULT 10,
  raid_window_secs       INT          DEFAULT 30,
  verification_enabled   TINYINT(1)   DEFAULT 0,
  verification_role_id   CHAR(36)     DEFAULT NULL,
  strike_1_action        ENUM('warn','mute','kick','ban') DEFAULT 'mute',
  strike_1_threshold     INT          DEFAULT 3,
  strike_2_action        ENUM('warn','mute','kick','ban') DEFAULT 'kick',
  strike_2_threshold     INT          DEFAULT 5,
  strike_3_action        ENUM('warn','mute','kick','ban') DEFAULT 'ban',
  strike_3_threshold     INT          DEFAULT 7,
  updated_at             DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── Reguły AutoMod ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS automod_rules (
  id         CHAR(36)     PRIMARY KEY,
  server_id  CHAR(36)     NOT NULL,
  type       ENUM('banned_word','spam','links','caps','invites') NOT NULL,
  value      VARCHAR(500) DEFAULT NULL,
  action     ENUM('delete','delete_warn','delete_mute') DEFAULT 'delete',
  enabled    TINYINT(1)   DEFAULT 1,
  created_at DATETIME     DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
  INDEX idx_server (server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── Strajki per serwer ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS server_strikes (
  id         CHAR(36)     PRIMARY KEY,
  user_id    CHAR(36)     NOT NULL,
  server_id  CHAR(36)     NOT NULL,
  reason     VARCHAR(500) NOT NULL,
  struck_by  CHAR(36)     DEFAULT NULL,
  auto       TINYINT(1)   DEFAULT 0,
  created_at DATETIME     DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id)   REFERENCES users(id)   ON DELETE CASCADE,
  FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
  INDEX idx_user_server (user_id, server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── Log akcji moderacyjnych ─────────────────────────────────
CREATE TABLE IF NOT EXISTS mod_action_log (
  id         CHAR(36)     PRIMARY KEY,
  server_id  CHAR(36)     NOT NULL,
  action     VARCHAR(32)  NOT NULL,
  mod_id     CHAR(36)     DEFAULT NULL,
  target_id  CHAR(36)     DEFAULT NULL,
  reason     VARCHAR(500) DEFAULT NULL,
  extra      JSON         DEFAULT NULL,
  created_at DATETIME     DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
  INDEX idx_server (server_id, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── Zaproszenia ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invites (
  code          VARCHAR(12)   PRIMARY KEY,
  server_id     CHAR(36)      NOT NULL,
  created_by    CHAR(36)      NOT NULL,
  uses          INT           DEFAULT 0,
  max_uses      INT           DEFAULT 0,
  expires_at    DATETIME      DEFAULT NULL,
  created_at    DATETIME      DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (server_id)  REFERENCES servers(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id)   ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── Forum: Posty ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS forum_posts (
  id            CHAR(36)      PRIMARY KEY,
  channel_id    CHAR(36)      NOT NULL,
  server_id     CHAR(36)      NOT NULL,
  author_id     CHAR(36)      NOT NULL,
  title         VARCHAR(256)  NOT NULL,
  content       MEDIUMTEXT    NOT NULL,
  gif_url       VARCHAR(512)  DEFAULT NULL,
  pinned        TINYINT(1)    DEFAULT 0,
  reply_count   INT           DEFAULT 0,
  last_reply_at DATETIME      DEFAULT CURRENT_TIMESTAMP,
  created_at    DATETIME      DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
  FOREIGN KEY (server_id)  REFERENCES servers(id)  ON DELETE CASCADE,
  FOREIGN KEY (author_id)  REFERENCES users(id)    ON DELETE CASCADE,
  INDEX idx_forum_channel  (channel_id, last_reply_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── Forum: Odpowiedzi ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS forum_replies (
  id            CHAR(36)      PRIMARY KEY,
  post_id       CHAR(36)      NOT NULL,
  author_id     CHAR(36)      NOT NULL,
  content       MEDIUMTEXT    NOT NULL,
  gif_url       VARCHAR(512)  DEFAULT NULL,
  created_at    DATETIME      DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (post_id)   REFERENCES forum_posts(id) ON DELETE CASCADE,
  FOREIGN KEY (author_id) REFERENCES users(id)       ON DELETE CASCADE,
  INDEX idx_reply_post (post_id, created_at ASC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
