# Project-Z — Voice & Chat Platform

Nowoczesny komunikator głosowy i tekstowy inspirowany Discordem.  
Stack: **Next.js 14 · TypeScript · Tailwind · Electron · Zustand · LiveKit · MySQL · Socket.io**

Aktualna wersja: **v0.6.7**

---

## Funkcje

### Czat
- 💬 **Wiadomości w czasie rzeczywistym** — Socket.io, paginacja (infinite scroll)
- ✏️ **Edycja wiadomości** — inline edytor, znacznik *(edytowano)*
- ↩️ **Odpowiedzi** — cytowanie wiadomości z paskiem podglądu
- 📌 **Przypinanie** — panel przypiętych wiadomości w nagłówku kanału
- 📁 **Wysyłanie plików** — drag & drop lub przycisk, miniatury obrazków, pobieranie plików
- 📊 **Ankiety** — kreator z opcjami, paski postępu, głosowanie w czasie rzeczywistym, czas trwania (auto-zamknięcie + karta wyników)
- 🎞️ **GIF-y** — wbudowana wyszukiwarka Tenor, wysyłanie jednym kliknięciem
- ⌨️ **Wskaźnik pisania** — animowane kropki gdy ktoś wpisuje tekst
- 😄 **Reakcje emoji** — własne emoji serwera + unicode
- 🔍 **Wyszukiwanie** — przeszukiwanie wiadomości na całym serwerze (Ctrl+F)

### Głos
- 🎙️ **Kanały głosowe** — LiveKit self-hosted (VAD, Push-to-Talk, wyciszenie, deafen)
- 🖥️ **Udostępnianie ekranu / kamera** — picker okien i monitorów
- 🎮 **Nakładka głosowa** — overlay z listą uczestników (Alt+Shift+O)
- 🖱️ **Globalny PTT** — mysz i klawiatura przez uiohook-napi

### Serwery i kanały
- 👥 **Role i uprawnienia** — granularny system, hierarchia, kolory, hoisting
- 🛡️ **Moderacja** — mute z czasem, kick, ban, zarządzanie wiadomościami
- 🗂️ **Kanały forum** — posty, wątki, odpowiedzi z GIF-ami
- 📨 **Zaproszenia** — generowanie linków, strona `/invite/[code]`
- 🔄 **Synchronizacja w czasie rzeczywistym** — tworzenie i usuwanie kanałów widoczne natychmiast dla wszystkich

### Aplikacja
- 🖥️ **Electron** — aplikacja desktopowa Windows z instalatorem NSIS
- 🔄 **Auto-updater** — pobieranie i instalacja aktualizacji w tle (GitHub Releases)
- 🎨 **8 motywów** — Ember, Ocean, Forest, Purple, Rose, Midnight, Sunset, Arctic
- 🔔 **Panel powiadomień** — historia zmian (patch notes), wzmianki, odpowiedzi
- 📊 **Status** — online/idle/dnd/offline + custom status
- ⚡ **Odznaka Dev** — widoczna przy nicku dla deweloperów platformy

---

## Architektura

```
project-z/
├── src/                          # Frontend Next.js
│   ├── app/
│   │   ├── page.tsx              # Główny widok (zalogowany)
│   │   ├── auth/login/           # Logowanie
│   │   ├── auth/register/        # Rejestracja
│   │   ├── invite/[code]/        # Strona zaproszenia
│   │   └── overlay/              # Nakładka głosowa (Electron)
│   ├── components/
│   │   ├── layout/
│   │   │   ├── ServerRail.tsx         # Pasek serwerów po lewej
│   │   │   ├── ChannelSidebar.tsx     # Lista kanałów
│   │   │   ├── NotificationsPanel.tsx # Powiadomienia + patch notes
│   │   │   └── UpdateBanner.tsx       # Baner auto-updater
│   │   ├── chat/
│   │   │   ├── ChatArea.tsx           # Główny obszar czatu + panel przypiętych
│   │   │   ├── ChatInput.tsx          # Pole wpisywania (pliki, GIF, ankiety, odpowiedzi)
│   │   │   ├── MessageItem.tsx        # Wiadomość (edycja, reakcje, załączniki, ankiety)
│   │   │   ├── PollModal.tsx          # Kreator ankiet
│   │   │   └── SearchPanel.tsx        # Wyszukiwanie wiadomości
│   │   ├── voice/
│   │   │   ├── VoiceDock.tsx          # Dolny pasek głosowy
│   │   │   ├── JoinVoiceButton.tsx    # Przycisk dołączenia + screen share
│   │   │   └── ScreenShareView.tsx    # Podgląd udostępnianego ekranu
│   │   ├── forum/
│   │   │   └── ForumView.tsx          # Widok kanału forum
│   │   ├── members/
│   │   │   └── MembersPanel.tsx       # Lista członków z rolami
│   │   └── settings/
│   │       ├── ServerSettings.tsx     # Ustawienia serwera
│   │       ├── RolesTab.tsx           # Zarządzanie rolami
│   │       └── UserSettings.tsx       # Konto, motywy, audio, PTT
│   ├── hooks/
│   │   ├── useSocket.ts          # Socket.io eventy + akcje
│   │   ├── useMessages.ts        # Ładowanie i mapowanie wiadomości
│   │   └── useVoice.ts           # LiveKit połączenie głosowe
│   └── lib/
│       ├── store.ts              # Zustand store
│       └── themes.ts             # Definicje 8 motywów
│
├── server/                       # Backend Express + Socket.io
│   └── src/
│       ├── index.ts              # Entry point, middleware, rate limiting
│       ├── routes/
│       │   ├── auth.ts           # Logowanie, rejestracja, JWT
│       │   ├── servers.ts        # CRUD serwerów, logo, zaproszenia, emoji
│       │   ├── messages.ts       # Wiadomości, przypinanie, reakcje, wyszukiwanie
│       │   ├── attachments.ts    # Upload i serwowanie plików (MEDIUMBLOB)
│       │   ├── polls.ts          # Ankiety, głosowanie, auto-zamknięcie
│       │   ├── forum.ts          # Posty i odpowiedzi forum
│       │   ├── gifs.ts           # Proxy Tenor API
│       │   ├── moderation.ts     # Mute, kick, ban, ostrzeżenia
│       │   ├── notifications.ts  # Powiadomienia użytkownika
│       │   ├── settings.ts       # Ustawienia użytkownika + CRUD kanałów
│       │   └── livekit.ts        # Tokeny LiveKit
│       ├── socket/               # Socket.io — eventy czatu i głosu
│       ├── db/
│       │   ├── schema.sql        # Schemat MySQL
│       │   ├── queries.ts        # Prepared statements
│       │   ├── pool.ts           # Połączenie MySQL
│       │   └── init.ts           # Auto-migracje przy starcie
│       ├── middleware/
│       │   ├── auth.ts           # JWT requireAuth
│       │   └── permissions.ts    # hasPermission, canModerate, isMuted
│       └── cache/
│           └── messages.ts       # In-memory cache (5 min TTL)
│
├── electron/
│   ├── main.js                   # Main process, IPC, auto-updater, overlay
│   └── preload.js                # contextBridge — electronPZ (bezpieczne IPC)
│
└── scripts/
    ├── build-extension.js        # Budowanie rozszerzenia PTT
    ├── generate-ico.js           # Generowanie icon.ico z PNG
    ├── package-electron.js       # electron-builder (NSIS installer)
    └── publish-release.js        # Build + publikacja na GitHub Releases
```

---

## Uruchomienie deweloperskie

### Wymagania
- Node.js 20+
- MySQL 8
- LiveKit server (opcjonalnie — tylko dla kanałów głosowych)

### Frontend + Backend

```bash
npm install
cd server && npm install && cd ..

# Frontend (Next.js dev server)
npm run dev
# → http://localhost:3000

# Backend (osobny terminal)
cd server && npm run dev
# → http://localhost:3001
```

### Electron (aplikacja desktopowa)

```bash
npm run electron:dev
```

---

## Zmienne środowiskowe

### Frontend (`.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_LIVEKIT_URL=ws://localhost:7880
```

### Backend (`server/.env`)

```env
PORT=3001
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=haslo
DB_NAME=nexus
JWT_SECRET=tajny_klucz
FRONTEND_URL=http://localhost:3000
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret
LIVEKIT_URL=ws://localhost:7880
DEV_USERNAMES=login
```

---

## Build i wydanie

### Installer Windows

```bash
npm run electron:build
# → dist-electron/Project-Z Setup x.x.x.exe
```

### Publikacja na GitHub Releases

```bash
GH_TOKEN=ghp_... npm run electron:publish
```

---

## Auto-updater

Przy starcie aplikacja sprawdza nowe wersje na GitHub Releases. Jeśli dostępna:
1. Baner w prawym dolnym rogu — **„Pobierz"**
2. Pobieranie w tle z paskiem postępu
3. **„Zainstaluj"** — restart + automatyczna instalacja

---

## Deployment (produkcja)

| Warstwa | Platforma |
|---|---|
| Frontend | Vercel (Next.js) + domena `project-z.cloud` |
| Backend | OVH VPS (Express + Socket.io) via `api.project-z.cloud` |
| Baza danych | MySQL 8 na VPS |
| LiveKit | Self-hosted na VPS via `livekit.project-z.cloud` |
| Tunel | Cloudflare Tunnel (stały, bez expiry) |
| Monitoring | PM2 + PM2+ |
| Pliki binarne | GitHub Releases |

---

## Licencja

Copyright © 2026. Wszelkie prawa zastrzeżone.
