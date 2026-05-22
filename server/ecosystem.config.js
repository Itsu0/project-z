/**
 * PM2 Ecosystem — uruchamianie backendu w trybie cluster
 *
 * Użycie:
 *   pm2 start ecosystem.config.js           # produkcja
 *   pm2 start ecosystem.config.js --env dev # development
 *   pm2 save && pm2 startup                 # autostart po restarcie serwera
 */

module.exports = {
  apps: [
    {
      name:             'nexus-backend',
      script:           './dist/index.js',

      // ── Cluster mode — wszystkie dostępne rdzenie CPU ─────────────────────
      // 'max' = tyle instancji ile rdzeni (np. 4-core VPS = 4 procesy)
      // Socket.io działa poprawnie w cluster dzięki domyślnemu sticky-session
      instances:        'max',
      exec_mode:        'cluster',

      // ── Restart policy ────────────────────────────────────────────────────
      watch:            false,           // nie restartuj przy zmianach plików
      max_memory_restart: '512M',        // restart jeśli proces zje > 512 MB RAM
      restart_delay:    3000,            // 3s między restartami przy crash

      // ── Node.js optymalizacje ─────────────────────────────────────────────
      node_args: [
        '--max-old-space-size=512',      // limit heap V8 (zapobiega OOM)
        '--optimize-for-size',           // mniejszy heap, wolniejszy GC — OK dla API
      ],

      // ── Logi ─────────────────────────────────────────────────────────────
      error_file:       './logs/error.log',
      out_file:         './logs/out.log',
      log_date_format:  'YYYY-MM-DD HH:mm:ss',
      merge_logs:       true,            // jeden plik dla wszystkich instancji

      // ── Zmienne środowiskowe ──────────────────────────────────────────────
      env: {
        NODE_ENV: 'production',
      },
      env_dev: {
        NODE_ENV: 'development',
        PORT: 3001,
      },
    },
  ],
}
