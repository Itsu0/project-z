'use client'
import { useState, useEffect, useCallback } from 'react'
import { useStore } from '@/lib/store'
import { useSocket } from '@/hooks/useSocket'
import { UserSettings } from '@/components/settings/UserSettings'
import { useT } from '@/lib/i18n'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

type NotifType = 'mention' | 'reply' | 'reaction'

interface Notification {
  id: string
  type: NotifType
  read_at: string | null
  created_at: string
  server_id: string
  channel_id: string
  message_id: string
  message_content: string
  author_name: string
  author_avatar_color: string
  author_avatar_url: string | null
  author_username: string
  server_name: string
  channel_name: string
  reply_to_id?: string
}

interface PatchEntry { type: string; pl: string; en: string }
interface PatchRelease { version: string; date: string; labelPl: string; labelEn: string; entries: PatchEntry[] }

const PATCH_NOTES: PatchRelease[] = [
  {
    version: '0.7.0',
    date: '2026-05-24',
    labelPl: 'Najnowsza',
    labelEn: 'Latest',
    entries: [
      { type: 'new', pl: 'Znajomi — wysyłanie/akceptowanie/odrzucanie zaproszeń, usuwanie znajomych, wyszukiwanie użytkowników', en: 'Friends — send/accept/decline requests, remove friends, search for users' },
      { type: 'new', pl: 'Weryfikacja dwuskładnikowa (2FA) — konfiguracja przez aplikację TOTP (Google Authenticator, Authy itp.)', en: 'Two-factor authentication (2FA) — setup via TOTP app (Google Authenticator, Authy, etc.)' },
      { type: 'new', pl: 'Resetowanie hasła — link resetujący wysyłany e-mailem, ważny 30 minut', en: 'Password reset — reset link sent by email, valid for 30 minutes' },
      { type: 'new', pl: 'Usuwanie konta — trwałe usunięcie konta z potwierdzeniem hasłem', en: 'Account deletion — permanently delete your account with password confirmation' },
      { type: 'imp', pl: 'Pełne tłumaczenie interfejsu — wszystkie zakładki ustawień, strony auth i dokumenty prawne dostępne w PL i EN', en: 'Full UI translation — all settings tabs, auth pages and legal documents available in PL and EN' },
      { type: 'fix', pl: 'Profil publiczny — pole totp_enabled teraz poprawnie zwracane przez API', en: 'Public profile — totp_enabled field now correctly returned by the API' },
    ],
  },
  {
    version: '0.6.9',
    date: '2026-05-22',
    labelPl: '',
    labelEn: '',
    entries: [
      { type: 'new', pl: 'Wielojęzyczność — dodano obsługę języka angielskiego; zmiana języka dostępna w Ustawieniach → Konto', en: 'Multilanguage — added English support; change language in Settings → Account' },
    ],
  },
  {
    version: '0.6.8',
    date: '2026-05-22',
    labelPl: '',
    labelEn: '',
    entries: [
      { type: 'new', pl: 'Rebrand — platforma działa teraz pod nazwą Project-Z', en: 'Rebrand — platform is now called Project-Z' },
      { type: 'new', pl: 'Własna domena — projekt dostępny pod adresem project-z.cloud z certyfikatem SSL', en: 'Custom domain — project available at project-z.cloud with SSL certificate' },
      { type: 'new', pl: 'Stały tunel Cloudflare — backend i LiveKit mają teraz stałe adresy, które nie zmieniają się po restarcie serwera', en: 'Permanent Cloudflare tunnel — backend and LiveKit now have stable addresses that do not change after server restart' },
      { type: 'fix', pl: 'Kanał głosowy — naprawiono błąd łączenia z localhost zamiast z serwerem produkcyjnym', en: 'Voice channel — fixed connection error pointing to localhost instead of production server' },
      { type: 'fix', pl: 'Kanały — usunięcie kanału nie blokuje już możliwości tworzenia nowych; zmiana widoczna natychmiast u wszystkich', en: 'Channels — deleting a channel no longer blocks creating new ones; change is immediately visible to everyone' },
      { type: 'imp', pl: 'Serwer głosowy — zwiększono limit jednoczesnych uczestników do 250, zoptymalizowano bufory UDP', en: 'Voice server — increased concurrent participant limit to 250, optimized UDP buffers' },
    ],
  },
  {
    version: '0.6.6',
    date: '2026-05-19',
    labelPl: '',
    labelEn: '',
    entries: [
      { type: 'fix', pl: 'Usuwanie wiadomości — znika natychmiast u wszystkich bez potrzeby odświeżania', en: 'Message deletion — disappears instantly for everyone without needing a refresh' },
      { type: 'new', pl: 'Wydajność — aplikacja szybciej ładuje wiadomości, szczególnie na dużych serwerach', en: 'Performance — app loads messages faster, especially on large servers' },
      { type: 'new', pl: 'Wyszukiwanie — szybsze i dokładniejsze wyniki na serwerach z dużą historią czatu', en: 'Search — faster and more accurate results on servers with a large chat history' },
    ],
  },
  {
    version: '0.6.5',
    date: '2026-05-19',
    labelPl: '',
    labelEn: '',
    entries: [
      { type: 'fix', pl: 'Ankiety — głosowanie zablokowane po upłynięciu czasu trwania ankiety', en: 'Polls — voting blocked after the poll duration expires' },
    ],
  },
  {
    version: '0.6.4',
    date: '2026-05-17',
    labelPl: '',
    labelEn: '',
    entries: [
      { type: 'fix', pl: 'Poprawki bezpieczeństwa — hardening serwera i aplikacji desktopowej', en: 'Security fixes — server and desktop app hardening' },
    ],
  },
  {
    version: '0.6.3',
    date: '2026-05-17',
    labelPl: '',
    labelEn: '',
    entries: [
      { type: 'fix', pl: 'Suwak w oknie GIF-ów — dopasowany do ciemnego motywu aplikacji, zamiast domyślnego białego paska przeglądarki', en: 'GIF picker scrollbar — now matches the dark app theme instead of the default white browser bar' },
    ],
  },
  {
    version: '0.6.2',
    date: '2026-05-12',
    labelPl: '',
    labelEn: '',
    entries: [
      { type: 'new', pl: '⏱ Czas trwania ankiet — wybierz 5 min, 10 min, 30 min, 1h, 6h lub 24h; ankieta automatycznie się zamknie i wyśle podsumowanie na kanał', en: '⏱ Poll duration — choose 5 min, 10 min, 30 min, 1h, 6h or 24h; poll closes automatically and sends a summary to the channel' },
      { type: 'new', pl: '📊 Odliczanie w ankiecie — timer widoczny na karcie ankiety do momentu zamknięcia', en: '📊 Poll countdown — timer visible on the poll card until it closes' },
      { type: 'new', pl: '🏆 Wyniki ankiety jako karta — po zamknięciu kanał dostaje wizualną kartę z paskami postępu i koroną przy zwycięzcy', en: '🏆 Poll results card — after closing, the channel gets a visual card with progress bars and a crown for the winner' },
    ],
  },
  {
    version: '0.6.1',
    date: '2026-05-10',
    labelPl: '',
    labelEn: '',
    entries: [
      { type: 'new', pl: '📁 Wysyłanie plików/obrazków — przycisk spinacza, drag & drop, miniatury obrazków w czacie, pobieranie plików', en: '📁 File/image uploads — paperclip button, drag & drop, image thumbnails in chat, file downloads' },
      { type: 'new', pl: '📊 Ankiety — przycisk 📊, kreator z pytaniem i opcjami, paski postępu z wynikami w czasie rzeczywistym, głosowanie/odgłosowanie', en: '📊 Polls — 📊 button, creator with question and options, real-time progress bars, vote/unvote' },
    ],
  },
  {
    version: '0.6.0',
    date: '2026-05-06',
    labelPl: '',
    labelEn: '',
    entries: [
      { type: 'new', pl: '📌 Przypinanie wiadomości — ikona pinezki przy hover, przypięte wiadomości dostępne z ikony w nagłówku kanału', en: '📌 Pin messages — pin icon on hover, pinned messages accessible from the channel header icon' },
      { type: 'new', pl: '✏️ Edytowanie wiadomości — ołówek przy hover, inline edytor; wiadomości edytowane opatrzone znacznikiem "(edytowano)"', en: '✏️ Edit messages — pencil on hover, inline editor; edited messages marked with "(edited)"' },
      { type: 'new', pl: '↩️ Odpowiedzi na wiadomości — przycisk przy hover, pasek "Odpowiadasz X" nad polem wpisywania, cytowanie widoczne w wiadomości', en: '↩️ Message replies — button on hover, "Replying to X" bar above input, quote visible in message' },
      { type: 'new', pl: '⌨️ Wskaźnik pisania — animowane kropki i "X pisze..." gdy ktoś wpisuje tekst', en: '⌨️ Typing indicator — animated dots and "X is typing..." when someone types' },
      { type: 'fix', pl: 'Udostępnianie ekranu naprawione — nowy mechanizm zgodny z Electron 31+', en: 'Screen sharing fixed — new mechanism compatible with Electron 31+' },
    ],
  },
  {
    version: '0.5.9',
    date: '2026-05-04',
    labelPl: '',
    labelEn: '',
    entries: [
      { type: 'fix', pl: 'Udostępnianie ekranu naprawione — nowy mechanizm zgodny z Electron 31+ (setDisplayMediaRequestHandler)', en: 'Screen sharing fixed — new mechanism compatible with Electron 31+ (setDisplayMediaRequestHandler)' },
    ],
  },
  {
    version: '0.5.8',
    date: '2026-05-03',
    labelPl: '',
    labelEn: '',
    entries: [
      { type: 'new', pl: 'Pasek kanałów — gdy kanałów za dużo, zawijają się do kolejnej linii zamiast wyjeżdżać poza ekran', en: 'Channel bar — when there are too many channels, they wrap to the next line instead of going off-screen' },
      { type: 'fix', pl: 'Przycisk "Opublikuj post" w forum — był nieaktywny przy pustej treści bez żadnego komunikatu; teraz wyświetla błąd', en: '"Publish post" button in forum — was inactive with empty content without any message; now shows an error' },
    ],
  },
  {
    version: '0.5.7',
    date: '2026-05-02',
    labelPl: '',
    labelEn: '',
    entries: [
      { type: 'fix', pl: 'Przycisk "Opublikuj post" w forum — przycisk nie był kliknięty gdy pole treści było puste (brak wizualnego komunikatu o błędzie); teraz pokazuje komunikat', en: '"Publish post" button in forum — button was not clickable when content was empty (no error message); now shows a message' },
    ],
  },
  {
    version: '0.5.6',
    date: '2026-05-01',
    labelPl: '',
    labelEn: '',
    entries: [
      { type: 'fix', pl: 'Forum naprawione — zapytania do bazy używają teraz pool.query() zamiast prepared statements, co eliminuje błąd 500 na Railway', en: 'Forum fixed — database queries now use pool.query() instead of prepared statements, eliminating 500 errors on Railway' },
      { type: 'fix', pl: 'GIF-y działają stabilnie — Tenor v1 API z poprawnym formatem odpowiedzi', en: 'GIFs work reliably — Tenor v1 API with correct response format' },
    ],
  },
  {
    version: '0.5.5',
    date: '2026-04-29',
    labelPl: '',
    labelEn: '',
    entries: [
      { type: 'fix', pl: 'GIF-y działają poprawnie — zmieniono API Tenor z v2 na v1 (g.tenor.com), które zwraca dane w prawidłowym formacie', en: 'GIFs work correctly — switched Tenor API from v2 to v1 (g.tenor.com), which returns data in the correct format' },
      { type: 'fix', pl: 'Forum naprawione — tabele forum_posts i forum_replies tworzone jawnie przy każdym starcie serwera, niezależnie od schema.sql', en: 'Forum fixed — forum_posts and forum_replies tables explicitly created on every server start, regardless of schema.sql' },
    ],
  },
  {
    version: '0.5.4',
    date: '2026-04-28',
    labelPl: '',
    labelEn: '',
    entries: [
      { type: 'fix', pl: 'GIF-y działają w Electronie — requesty przechodzą przez serwer backend zamiast bezpośrednio do Tenor (omijanie blokady CORS/TLS)', en: 'GIFs work in Electron — requests go through the backend server instead of directly to Tenor (bypassing CORS/TLS block)' },
      { type: 'fix', pl: 'Posty forum wyświetlają się poprawnie — naprawiono sortowanie dla nowych postów bez odpowiedzi', en: 'Forum posts display correctly — fixed sorting for new posts without replies' },
      { type: 'imp', pl: 'Forum pokazuje teraz komunikat błędu z przyciskiem "Spróbuj ponownie" zamiast cichej pustej listy', en: 'Forum now shows an error message with a "Try again" button instead of a silent empty list' },
    ],
  },
  {
    version: '0.5.3',
    date: '2026-04-27',
    labelPl: '',
    labelEn: '',
    entries: [
      { type: 'fix', pl: 'GIF-y działają ponownie — zmieniono dostawcę z Giphy (wycofany klucz publiczny) na Tenor (Google)', en: 'GIFs work again — switched provider from Giphy (deprecated public key) to Tenor (Google)' },
      { type: 'imp', pl: 'Picker GIF-ów w czacie i forum korzysta z Tenor API — stabilniejszy, bez limitów dla normalnego użycia', en: 'GIF picker in chat and forum uses Tenor API — more stable, no limits for normal usage' },
    ],
  },
  {
    version: '0.5.2',
    date: '2026-04-24',
    labelPl: '',
    labelEn: '',
    entries: [
      { type: 'fix', pl: 'Ustawienia → Konto: numer wersji aplikacji widoczny od razu, bez konieczności klikania przycisku', en: 'Settings → Account: app version number visible immediately, no need to click a button' },
      { type: 'fix', pl: 'Picker wyboru okna do stream — okno modalne wyrenderowane przez portal, zawsze na środku ekranu', en: 'Stream window picker — modal rendered via portal, always centered on screen' },
      { type: 'fix', pl: 'Przycisk "Udostępnij ekran" w widoku kanału głosowego otwiera teraz picker okien', en: '"Share screen" button in voice channel view now opens the window picker' },
    ],
  },
  {
    version: '0.5.1',
    date: '2026-04-22',
    labelPl: '',
    labelEn: '',
    entries: [
      { type: 'new', pl: 'Picker okien przy udostępnianiu ekranu — zamiast całego ekranu możesz wybrać konkretne okno lub monitor z podglądem miniatur', en: 'Window picker for screen sharing — choose a specific window or monitor with thumbnail previews instead of the full screen' },
      { type: 'new', pl: 'Przycisk GIF w polu wiadomości — wbudowana wyszukiwarka Giphy (trendy + wyszukiwanie), GIF wysyłany jednym kliknięciem', en: 'GIF button in message field — built-in Giphy search (trending + search), GIF sent with one click' },
      { type: 'imp', pl: 'GIF-y wysłane przez czat wyświetlają się jako obrazek, maks. 256px wysokości z zaokrąglonymi rogami', en: 'GIFs sent in chat display as images, max 256px height with rounded corners' },
    ],
  },
  {
    version: '0.5.0',
    date: '2026-04-20',
    labelPl: '',
    labelEn: '',
    entries: [
      { type: 'new', pl: 'Forum przebudowane od podstaw — posty, wątki i odpowiedzi jak na Discordzie, zupełnie nowy interfejs z kartami postów', en: 'Forum rebuilt from scratch — posts, threads and replies like Discord, brand new interface with post cards' },
      { type: 'new', pl: 'Wsparcie GIF w forum — wbudowana wyszukiwarka Giphy w oknie tworzenia postów i odpowiedzi', en: 'GIF support in forum — built-in Giphy search in the post and reply creation window' },
      { type: 'new', pl: 'Podgląd GIF w odpowiedziach — miniatura przed wysłaniem z możliwością usunięcia', en: 'GIF preview in replies — thumbnail before sending with the option to remove' },
      { type: 'imp', pl: 'Licznik odpowiedzi i data ostatniej aktywności widoczne bezpośrednio na karcie posta', en: 'Reply count and last activity date visible directly on the post card' },
      { type: 'imp', pl: 'Pasek wyszukiwania postów w widoku forum — filtruje lokalnie po tytule i treści', en: 'Post search bar in forum view — filters locally by title and content' },
    ],
  },
  {
    version: '0.4.9',
    date: '2026-04-14',
    labelPl: '',
    labelEn: '',
    entries: [
      { type: 'new', pl: 'Kanały Forum — nowy typ kanału (🗂) przeznaczony na wątki i dyskusje', en: 'Forum channels — new channel type (🗂) designed for threads and discussions' },
      { type: 'new', pl: 'Przycisk „Sprawdź aktualizacje" w Ustawieniach → Konto — wyświetla status i komunikat błędu', en: '"Check for updates" button in Settings → Account — shows status and error message' },
      { type: 'imp', pl: 'Automatyczna aktualizacja działa poprawnie na Windows z antywirusem przechwytującym TLS', en: 'Auto-update works correctly on Windows with antivirus intercepting TLS' },
      { type: 'imp', pl: 'Baner aktualizacji pojawia się niezawodnie — zdarzenie jest buforowane do momentu załadowania strony', en: 'Update banner appears reliably — event is buffered until the page loads' },
      { type: 'fix', pl: 'Wyszukiwanie wiadomości (Ctrl+F) — naprawiono brak wyników dla starszych wiadomości', en: 'Message search (Ctrl+F) — fixed missing results for older messages' },
      { type: 'fix', pl: 'Usunięto zbędny przycisk „Zastosuj motyw i tryb" — ustawienia zapisują się automatycznie', en: 'Removed redundant "Apply theme and mode" button — settings save automatically' },
    ],
  },
  {
    version: '0.4.1',
    date: '2026-04-12',
    labelPl: '',
    labelEn: '',
    entries: [
      { type: 'new', pl: 'Wyszukiwanie wiadomości (Ctrl+F) — przeszukuje wszystkie kanały serwera z podświetlaniem frazy i przejściem do wiadomości', en: 'Message search (Ctrl+F) — searches all server channels with phrase highlighting and jump to message' },
      { type: 'new', pl: 'Auto-updater — aplikacja wykrywa nowe wersje przy starcie i oferuje pobranie w tle', en: 'Auto-updater — app detects new versions on startup and offers background download' },
      { type: 'new', pl: 'Odznaka ⚡ Dev przy nicku dewelopera platformy', en: '⚡ Dev badge next to the platform developer\'s username' },
      { type: 'fix', pl: 'Przesyłanie logo serwera — naprawiono błąd bazy danych (zła nazwa kolumny, VARCHAR→MEDIUMTEXT)', en: 'Server logo upload — fixed database error (wrong column name, VARCHAR→MEDIUMTEXT)' },
      { type: 'fix', pl: 'Logo serwera widoczne wszędzie — ujednolicono nazwę pola icon_url w całym frontendzie', en: 'Server logo visible everywhere — unified icon_url field name throughout the frontend' },
    ],
  },
  {
    version: '0.4.0',
    date: '2026-04-05',
    labelPl: '',
    labelEn: '',
    entries: [
      { type: 'new', pl: '8 motywów kolorystycznych — Ember, Ocean, Forest, Purple, Rose, Midnight, Sunset, Arctic — zmiana na żywo bez restartu', en: '8 color themes — Ember, Ocean, Forest, Purple, Rose, Midnight, Sunset, Arctic — live change without restart' },
      { type: 'new', pl: 'Zakładka „Co nowego" z pełną historią zmian w aplikacji', en: '"What\'s new" tab with full change history in the app' },
      { type: 'imp', pl: 'Rozmiar tekstu (Mały 14px / Normalny 16px / Duży 18px) zmienia się natychmiast bez restartu', en: 'Text size (Small 14px / Normal 16px / Large 18px) changes instantly without restart' },
      { type: 'imp', pl: 'Tryb kompaktowy — mniejsze odstępy między wiadomościami, działa w czasie rzeczywistym', en: 'Compact mode — smaller spacing between messages, works in real-time' },
      { type: 'fix', pl: 'Push-to-Talk — naprawiono brak działania skrótu PTT po ponownym uruchomieniu aplikacji', en: 'Push-to-Talk — fixed PTT shortcut not working after restarting the app' },
      { type: 'fix', pl: 'Zdjęcia profilowe nie znikają po restarcie aplikacji', en: 'Profile pictures no longer disappear after restarting the app' },
      { type: 'fix', pl: 'Status (DND, Zaraz wracam itp.) aktualizuje się natychmiast w panelu członków u wszystkich', en: 'Status (DND, Away, etc.) updates instantly in the member panel for everyone' },
    ],
  },
  {
    version: '0.3.0',
    date: '2026-03-25',
    labelPl: '',
    labelEn: '',
    entries: [
      { type: 'new', pl: 'Szybkie nadawanie rangi z menu kontekstowego (⋮) przy każdym członku', en: 'Quick role assignment from the context menu (⋮) next to each member' },
      { type: 'new', pl: 'Hierarchia ról — Moderator nie może moderować, wyciszyć ani zbanować Administratora', en: 'Role hierarchy — Moderator cannot moderate, mute or ban an Administrator' },
      { type: 'imp', pl: 'Ranga pojawia się natychmiast po nadaniu — bez odświeżania strony', en: 'Role appears immediately after assignment — no page refresh needed' },
      { type: 'imp', pl: 'Kanały odblokowują się natychmiast po zmianie roli bez restartu', en: 'Channels unlock immediately after role change without restart' },
      { type: 'fix', pl: 'Dołączanie przez link zaproszenia — nowy członek pojawia się natychmiast u wszystkich', en: 'Joining via invite link — new member appears instantly for everyone' },
      { type: 'fix', pl: 'Nakładka głosowa (Alt+Shift+O) — nie znikała po ponownym wywołaniu skrótu', en: 'Voice overlay (Alt+Shift+O) — was not dismissing when shortcut was called again' },
    ],
  },
  {
    version: '0.2.1',
    date: '2026-03-12',
    labelPl: '',
    labelEn: '',
    entries: [
      { type: 'new', pl: 'Nakładka głosowa w grze — wyświetla uczestników kanału z animacją mówienia', en: 'In-game voice overlay — displays channel participants with speaking animation' },
      { type: 'new', pl: 'Skrót Alt+Shift+O do pokazania/ukrycia nakładki', en: 'Alt+Shift+O shortcut to show/hide the overlay' },
      { type: 'new', pl: 'Instalator NSIS — pełny instalator Windows z uiohook-napi', en: 'NSIS installer — full Windows installer with uiohook-napi' },
      { type: 'new', pl: 'Globalne PTT przez mysz za pomocą uiohook-napi (przycisk myszy jako Push-to-Talk)', en: 'Global mouse PTT via uiohook-napi (mouse button as Push-to-Talk)' },
      { type: 'imp', pl: 'Nakładka przez IPC zamiast BroadcastChannel — stabilniejsza komunikacja między procesami', en: 'Overlay via IPC instead of BroadcastChannel — more stable inter-process communication' },
      { type: 'fix', pl: 'Wyrzucanie członków — brakowało zdarzenia MEMBER_LEAVE, panel nie odświeżał listy', en: 'Kicking members — missing MEMBER_LEAVE event, panel was not refreshing the list' },
    ],
  },
  {
    version: '0.2.0',
    date: '2026-03-01',
    labelPl: '',
    labelEn: '',
    entries: [
      { type: 'new', pl: 'Aplikacja desktopowa Electron (Windows) — pierwsza wersja .exe', en: 'Electron desktop app (Windows) — first .exe release' },
      { type: 'new', pl: 'Push-to-Talk z przyciskiem myszy', en: 'Push-to-Talk with mouse button' },
      { type: 'imp', pl: 'Wyłączenie throttlingu Chromium w tle — naprawia brak dźwięku podczas grania', en: 'Disabled Chromium background throttling — fixes missing audio while gaming' },
      { type: 'fix', pl: 'Mikrofon USB nie nadawał dźwięku przy dołączaniu do kanału', en: 'USB microphone not transmitting audio when joining a channel' },
      { type: 'fix', pl: 'Deadlock VAD powodujący brak dźwięku przy starcie', en: 'VAD deadlock causing no audio at startup' },
    ],
  },
  {
    version: '0.1.1',
    date: '2026-02-14',
    labelPl: '',
    labelEn: '',
    entries: [
      { type: 'new', pl: 'Autouzupełnianie @wzmianek z wyszukiwaniem, strzałkami, @everyone i @here', en: '@mention autocomplete with search, arrow navigation, @everyone and @here' },
      { type: 'new', pl: 'Zdarzenia MEMBER_JOIN/MEMBER_LEAVE — lista członków aktualizuje się na żywo', en: 'MEMBER_JOIN/MEMBER_LEAVE events — member list updates in real-time' },
      { type: 'new', pl: 'Odznaka Dev (⚡) dla deweloperów — kolumna is_dev + zmienna DEV_USERNAMES', en: 'Dev badge (⚡) for developers — is_dev column + DEV_USERNAMES variable' },
      { type: 'fix', pl: 'Avatar znikał po wysłaniu wiadomości — unieważnienie cache profilu', en: 'Avatar disappeared after sending a message — profile cache invalidation' },
    ],
  },
  {
    version: '0.1.0',
    date: '2026-02-01',
    labelPl: 'Pierwsze wydanie',
    labelEn: 'First release',
    entries: [
      { type: 'new', pl: 'Serwery z kanałami tekstowymi, głosowymi, ogłoszeniowymi i forum', en: 'Servers with text, voice, announcement and forum channels' },
      { type: 'new', pl: 'System ról i uprawnień (Administrator, Moderator, Członek, Do Weryfikacji)', en: 'Role and permission system (Administrator, Moderator, Member, Pending)' },
      { type: 'new', pl: 'Wyciszanie, wyrzucanie i banowanie członków z potwierdzeniem', en: 'Muting, kicking and banning members with confirmation' },
      { type: 'new', pl: 'Powiadomienia — wzmianki, odpowiedzi, reakcje z szybką odpowiedzią', en: 'Notifications — mentions, replies, reactions with quick reply' },
      { type: 'new', pl: 'Własne emoji serwera (do 50 sztuk)', en: 'Custom server emoji (up to 50)' },
      { type: 'new', pl: 'Połączenia głosowe przez LiveKit — VAD, Push-to-Talk, wyciszanie, deafen', en: 'Voice calls via LiveKit — VAD, Push-to-Talk, mute, deafen' },
      { type: 'new', pl: 'Udostępnianie ekranu i kamera w kanałach głosowych', en: 'Screen sharing and camera in voice channels' },
      { type: 'new', pl: 'Linki zaproszenia do serwerów', en: 'Server invite links' },
      { type: 'new', pl: 'Ustawienia profilu — avatar, status, kolor, niestandardowy status', en: 'Profile settings — avatar, status, color, custom status' },
      { type: 'new', pl: 'Ustawienia audio — urządzenie, głośność, VAD, PTT, profil jakości', en: 'Audio settings — device, volume, VAD, PTT, quality profile' },
      { type: 'new', pl: 'Panel administracyjny dla deweloperów', en: 'Admin panel for developers' },
    ],
  },
]

const ENTRY_COLORS = {
  new: { color: '#22c55e', bg: 'rgba(34,197,94,0.1)'  },
  fix: { color: '#60a5fa', bg: 'rgba(96,165,250,0.1)' },
  imp: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
}

function PatchNotes() {
  const t = useT()
  const lang = useStore(s => s.userSettings.language ?? 'pl')

  const labelMap = {
    new: t('notif.changelog.new'),
    fix: t('notif.changelog.fix'),
    imp: t('notif.changelog.imp'),
  }

  return (
    <div className="pt-2 flex flex-col gap-4">
      {PATCH_NOTES.map(release => {
        const label = lang === 'en' ? release.labelEn : release.labelPl
        return (
          <div key={release.version}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ background: 'var(--eb-gradient)', color: '#fff' }}>
                v{release.version}
              </span>
              {label && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '0.5px solid rgba(34,197,94,0.3)' }}>
                  {label}
                </span>
              )}
              <span className="text-[10px] ml-auto" style={{ color: 'var(--eb-text3)' }}>{release.date}</span>
            </div>

            <div className="flex flex-col gap-1.5 pl-1">
              {release.entries.map((entry, i) => {
                const meta = ENTRY_COLORS[entry.type as keyof typeof ENTRY_COLORS] ?? ENTRY_COLORS.new
                const text = lang === 'en' ? entry.en : entry.pl
                return (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded mt-0.5 flex-shrink-0"
                      style={{ background: meta.bg, color: meta.color }}>
                      {labelMap[entry.type as keyof typeof labelMap] ?? entry.type}
                    </span>
                    <span className="text-[11px] leading-snug" style={{ color: 'var(--eb-text2)' }}>
                      {text}
                    </span>
                  </div>
                )
              })}
            </div>

            <div className="mt-3 h-px" style={{ background: 'var(--eb-border)' }} />
          </div>
        )
      })}
    </div>
  )
}

const NOTIF_COLORS: Record<NotifType, { color: string; icon: string }> = {
  mention:  { color: '#f87171', icon: '@' },
  reply:    { color: '#4a9eff', icon: '↩' },
  reaction: { color: '#f59e0b', icon: '😄' },
}

export function NotificationsPanelExpanded() {
  const t = useT()
  const { token, currentServerId } = useStore()
  const { currentUser } = useStore()
  const socket = useSocket()
  const [notifs, setNotifs] = useState<Notification[]>([])
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'patchnotes'>('unread')
  const [loading, setLoading] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  const STATUS_META: Record<string, { color: string; label: string }> = {
    online:  { color: '#22c55e', label: t('status.online') },
    idle:    { color: '#f59e0b', label: t('status.idle') },
    dnd:     { color: '#ef4444', label: t('status.dnd') },
    offline: { color: '#6b7280', label: t('status.offline') },
  }
  const status     = (currentUser?.status as string) ?? 'offline'
  const statusMeta = STATUS_META[status] ?? STATUS_META.offline
  const avatarColor = currentUser?.avatar_color ?? 'linear-gradient(135deg,#dc2626,#f59e0b)'
  const initial     = (currentUser?.display_name ?? '?').slice(0, 1).toUpperCase()

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const res = await fetch(`${BASE}/api/notifications?limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      setNotifs(data.notifications ?? [])
    } catch {}
    finally { setLoading(false) }
  }, [token])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const onFocus = () => load()
    window.addEventListener('focus', onFocus)
    const interval = setInterval(load, 30000)
    return () => { window.removeEventListener('focus', onFocus); clearInterval(interval) }
  }, [load])

  useEffect(() => {
    if (!socket) return
    const handler = () => load()
    socket.on('NOTIFICATION', handler)
    return () => { socket.off('NOTIFICATION', handler) }
  }, [socket, load])

  const unreadCount = notifs.filter(n => !n.read_at).length
  const visible = activeTab === 'unread' ? notifs.filter(n => !n.read_at) : notifs

  async function markRead(id: string) {
    if (!token) return
    setNotifs(p => p.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
    await fetch(`${BASE}/api/notifications/read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ notifId: id }),
    })
  }

  function markReadAndSwitch(id: string) {
    markRead(id)
    setActiveTab('all')
  }

  async function markAllRead() {
    if (!token) return
    setNotifs(p => p.map(n => ({ ...n, read_at: new Date().toISOString() })))
    await fetch(`${BASE}/api/notifications/read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({}),
    })
  }

  function deleteNotif(id: string) {
    setNotifs(p => p.filter(n => n.id !== id))
    fetch(`${BASE}/api/notifications/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {})
  }

  function deleteAllNotifs() {
    setNotifs([])
    fetch(`${BASE}/api/notifications`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {})
  }

  function sendReply(notif: Notification) {
    if (!replyText.trim()) return
    socket.sendMessage(notif.channel_id, notif.server_id, replyText.trim(), undefined, notif.message_id)
    setNotifs(p => p.filter(n => n.id !== notif.id))
    fetch(`${BASE}/api/notifications/read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ notifId: notif.id }),
    }).catch(() => {})
    setReplyingTo(null)
    setReplyText('')
  }

  function formatTime(dateStr: string) {
    const d = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 1) return 'teraz'
    if (diffMins < 60) return `${diffMins} min temu`
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)} godz temu`
    return d.toLocaleDateString('pl')
  }

  return (
    <div className="flex flex-col overflow-hidden"
      style={{ width: 280, background: 'var(--eb-bg1)', borderRight: '0.5px solid var(--eb-border)' }}>

      {}
      <div className="px-4 pt-4 pb-3 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--eb-accent)" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            <span className="font-semibold text-sm" style={{ color: 'var(--eb-text1)' }}>{t('notif.title')}</span>
            {unreadCount > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white"
                style={{ background: 'var(--eb-accent2)' }}>{unreadCount}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-[10px] transition-opacity hover:opacity-70"
                style={{ color: 'var(--eb-accent)' }}>
                {t('notif.markAllRead')}
              </button>
            )}
            {activeTab === 'all' && notifs.length > 0 && (
              <button onClick={deleteAllNotifs} className="text-[10px] transition-opacity hover:opacity-70"
                style={{ color: 'var(--eb-accent2)' }}>
                Usuń wszystkie
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
          {([['unread', t('notif.tabNew', { n: unreadCount })], ['all', t('notif.tabAll')], ['patchnotes', t('notif.tabChangelog')]] as [string, string][]).map(([tab, label]) => (
            <button key={tab} onClick={() => setActiveTab(tab as any)}
              className="flex-1 py-1 text-xs rounded-md font-medium transition-all duration-150"
              style={activeTab === tab
                ? { background: 'var(--eb-gradient)', color: '#fff' }
                : { color: 'var(--eb-text2)' }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {}
      {activeTab === 'patchnotes' && (
        <div className="flex-1 overflow-y-auto px-3 pb-4">
          <PatchNotes />
        </div>
      )}

      {}
      {activeTab !== 'patchnotes' && <div className="flex-1 overflow-y-auto px-2 pb-3">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--eb-text3)" strokeWidth="2">
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
          </div>
        )}

        {!loading && visible.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 gap-2">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--eb-text3)" strokeWidth="1.5">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            <span style={{ fontSize: 12, color: 'var(--eb-text3)' }}>{activeTab === 'unread' ? t('notif.noNew') : t('notif.noAll')}</span>
          </div>
        )}

        {!loading && (activeTab === 'all' || activeTab === 'unread') && visible.map(notif => {
          const notifColors = NOTIF_COLORS[notif.type]
          const notifLabel = notif.type === 'mention' ? t('notif.mention') : notif.type === 'reply' ? t('notif.reply') : t('notif.reaction')
          const isReplying = replyingTo === notif.id
          const canReply = notif.type === 'mention' || notif.type === 'reply'

          return (
            <div key={notif.id}
              className="rounded-xl p-3 mb-2 transition-all duration-150"
              style={{
                background: notif.read_at ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.05)',
                border: `0.5px solid ${notif.read_at ? 'var(--eb-border)' : 'rgba(255,255,255,0.1)'}`,
              }}>

              {}
              <div className="flex items-start gap-2.5 mb-2">
                <div className="relative flex-shrink-0">
                  <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center text-white font-semibold text-xs"
                    style={{ background: notif.author_avatar_url ? 'transparent' : notif.author_avatar_color }}>
                    {notif.author_avatar_url
                      ? <img src={notif.author_avatar_url} alt="" className="w-full h-full object-cover" />
                      : notif.author_name.slice(0, 1)
                    }
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold"
                    style={{ background: notifColors.color, border: '1.5px solid var(--eb-bg1)', color: '#fff' }}>
                    {notifColors.icon}
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-xs font-semibold truncate" style={{ color: 'var(--eb-text1)' }}>
                      {notif.author_name}
                    </span>
                    <span className="text-[9px] font-medium px-1.5 py-px rounded-full flex-shrink-0"
                      style={{ background: `${notifColors.color}22`, color: notifColors.color }}>
                      {notifLabel}
                    </span>
                    {!notif.read_at && (
                      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 ml-auto"
                        style={{ background: 'var(--eb-accent)' }} />
                    )}
                  </div>
                  <div className="mb-1">
                    <span style={{ fontSize: 9, color: 'var(--eb-text3)' }}>
                      {notif.server_name} · #{notif.channel_name} · {formatTime(notif.created_at)}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed line-clamp-2" style={{ color: 'var(--eb-text2)' }}>
                    {notif.message_content}
                  </p>
                </div>
              </div>

              {}
              {canReply && (
                <div onClick={e => e.stopPropagation()}>
                  {!isReplying ? (
                    <div className="flex gap-1.5">
                      <button
                        onClick={e => { e.stopPropagation(); setReplyingTo(notif.id) }}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 flex-1 justify-center"
                        style={{ background: 'var(--eb-surface)', color: 'var(--eb-accent)', border: '0.5px solid var(--eb-accent)' }}>
                        ↩ Szybka odpowiedź
                      </button>
                      {!notif.read_at && (
                        <button
                          onClick={e => { e.stopPropagation(); markReadAndSwitch(notif.id) }}
                          className="px-2.5 py-1.5 rounded-lg text-xs transition-all"
                          style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--eb-text3)', border: '0.5px solid var(--eb-border)' }}
                          title="Oznacz jako przeczytane">
                          ✓
                        </button>
                      )}
                      {activeTab === 'all' && (
                        <button
                          onClick={e => { e.stopPropagation(); deleteNotif(notif.id) }}
                          className="px-2.5 py-1.5 rounded-lg text-xs transition-all"
                          style={{ background: 'rgba(220,38,38,0.08)', color: 'var(--eb-accent2)', border: '0.5px solid rgba(220,38,38,0.2)' }}
                          title="Usuń powiadomienie">
                          ✕
                        </button>
                      )}
                    </div>
                  ) : (
                    <div>
                      <div className="mb-1.5 px-2 py-1 rounded-md text-[10px]"
                        style={{ background: 'var(--eb-surface)', color: 'var(--eb-text2)', borderLeft: '2px solid var(--eb-accent)' }}>
                        Odpowiadasz w #{notif.channel_name}
                      </div>
                      <div className="flex gap-1.5">
                        <input autoFocus
                          value={replyText}
                          onChange={e => setReplyText(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') sendReply(notif)
                            if (e.key === 'Escape') { setReplyingTo(null); setReplyText('') }
                          }}
                          placeholder="Napisz odpowiedź..."
                          className="ember-input flex-1 px-2.5 py-1.5"
                          style={{ fontSize: 11 }}
                        />
                        <button onClick={() => sendReply(notif)} disabled={!replyText.trim()}
                          className="px-2.5 rounded-lg flex items-center justify-center transition-all"
                          style={{
                            background: replyText.trim() ? 'var(--eb-gradient)' : 'rgba(255,255,255,0.05)',
                            color: replyText.trim() ? '#fff' : 'var(--eb-text3)',
                          }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                          </svg>
                        </button>
                        <button onClick={() => { setReplyingTo(null); setReplyText('') }}
                          className="px-2 rounded-lg text-xs"
                          style={{ color: 'var(--eb-text3)', background: 'rgba(255,255,255,0.03)' }}>
                          ✕
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {!canReply && activeTab === 'all' && (
                <div className="flex justify-end" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={e => { e.stopPropagation(); deleteNotif(notif.id) }}
                    className="px-2.5 py-1.5 rounded-lg text-xs transition-all"
                    style={{ background: 'rgba(220,38,38,0.08)', color: 'var(--eb-accent2)', border: '0.5px solid rgba(220,38,38,0.2)' }}
                    title="Usuń powiadomienie">
                    ✕
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>}

      {}
      <div
        className="flex items-center gap-2.5 px-3 py-2.5 border-t cursor-pointer transition-colors hover:bg-white/[0.04] group flex-shrink-0"
        style={{ background: 'var(--eb-bg0)', borderColor: 'var(--eb-border)' }}
        onClick={() => setShowSettings(true)}
        title="Ustawienia użytkownika"
      >
        <div className="relative flex-shrink-0">
          <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center text-white font-bold text-sm"
            style={{ background: currentUser?.avatar_url ? 'transparent' : avatarColor }}>
            {currentUser?.avatar_url
              ? <img src={currentUser.avatar_url} alt="avatar" className="w-full h-full object-cover" />
              : initial
            }
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2"
            style={{ background: statusMeta.color, borderColor: 'var(--eb-bg0)' }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold truncate leading-tight" style={{ color: 'var(--eb-text1)' }}>
            {currentUser?.display_name ?? '...'}
          </div>
          <div className="text-[10px] font-medium mt-0.5" style={{ color: statusMeta.color }}>
            {statusMeta.label}
          </div>
        </div>
        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" style={{ color: 'var(--eb-text3)' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </div>
      </div>

      {showSettings && <UserSettings onClose={() => setShowSettings(false)} />}
    </div>
  )
}
