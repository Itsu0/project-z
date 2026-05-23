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
  author_username: string
  server_name: string
  channel_name: string
  reply_to_id?: string
}

const PATCH_NOTES = [
  {
    version: '0.6.9',
    date: '2026-05-22',
    label: 'Najnowsza',
    entries: [
      { type: 'new', text: 'Wielojęzyczność — dodano obsługę języka angielskiego; zmiana języka dostępna w Ustawieniach → Konto' },
    ],
  },
  {
    version: '0.6.8',
    date: '2026-05-22',
    label: '',
    entries: [
      { type: 'new', text: 'Rebrand — platforma działa teraz pod nazwą Project-Z' },
      { type: 'new', text: 'Własna domena — projekt dostępny pod adresem project-z.cloud z certyfikatem SSL' },
      { type: 'new', text: 'Stały tunel Cloudflare — backend i LiveKit mają teraz stałe adresy, które nie zmieniają się po restarcie serwera' },
      { type: 'fix', text: 'Kanał głosowy — naprawiono błąd łączenia z localhost zamiast z serwerem produkcyjnym' },
      { type: 'fix', text: 'Kanały — usunięcie kanału nie blokuje już możliwości tworzenia nowych; zmiana widoczna natychmiast u wszystkich' },
      { type: 'imp', text: 'Serwer głosowy — zwiększono limit jednoczesnych uczestników do 250, zoptymalizowano bufory UDP' },
    ],
  },
  {
    version: '0.6.6',
    date: '2026-05-19',
    label: '',
    entries: [
      { type: 'fix', text: 'Usuwanie wiadomości — znika natychmiast u wszystkich bez potrzeby odświeżania' },
      { type: 'new', text: 'Wydajność — aplikacja szybciej ładuje wiadomości, szczególnie na dużych serwerach' },
      { type: 'new', text: 'Wyszukiwanie — szybsze i dokładniejsze wyniki na serwerach z dużą historią czatu' },
    ],
  },
  {
    version: '0.6.5',
    date: '2026-05-19',
    label: '',
    entries: [
      { type: 'fix', text: 'Ankiety — głosowanie zablokowane po upłynięciu czasu trwania ankiety' },
    ],
  },
  {
    version: '0.6.4',
    date: '2026-05-17',
    label: '',
    entries: [
      { type: 'fix',  text: 'Poprawki bezpieczeństwa — hardening serwera i aplikacji desktopowej' },
    ],
  },
  {
    version: '0.6.3',
    date: '2026-05-17',
    label: '',
    entries: [
      { type: 'fix',  text: 'Suwak w oknie GIF-ów — dopasowany do ciemnego motywu aplikacji, zamiast domyślnego białego paska przeglądarki' },
    ],
  },
  {
    version: '0.6.2',
    date: '2026-05-12',
    label: '',
    entries: [
      { type: 'new',  text: '⏱ Czas trwania ankiet — wybierz 5 min, 10 min, 30 min, 1h, 6h lub 24h; ankieta automatycznie się zamknie i wyśle podsumowanie na kanał' },
      { type: 'new',  text: '📊 Odliczanie w ankiecie — timer widoczny na karcie ankiety do momentu zamknięcia' },
      { type: 'new',  text: '🏆 Wyniki ankiety jako karta — po zamknięciu kanał dostaje wizualną kartę z paskami postępu i koroną przy zwycięzcy' },
    ],
  },
  {
    version: '0.6.1',
    date: '2026-05-10',
    label: '',
    entries: [
      { type: 'new',  text: '📁 Wysyłanie plików/obrazków — przycisk spinacza, drag & drop, miniatury obrazków w czacie, pobieranie plików' },
      { type: 'new',  text: '📊 Ankiety — przycisk 📊, kreator z pytaniem i opcjami, paski postępu z wynikami w czasie rzeczywistym, głosowanie/odgłosowanie' },
    ],
  },
  {
    version: '0.6.0',
    date: '2026-05-06',
    label: '',
    entries: [
      { type: 'new',  text: '📌 Przypinanie wiadomości — ikona pinezki przy hover, przypięte wiadomości dostępne z ikony w nagłówku kanału' },
      { type: 'new',  text: '✏️ Edytowanie wiadomości — ołówek przy hover, inline edytor; wiadomości edytowane opatrzone znacznikiem "(edytowano)"' },
      { type: 'new',  text: '↩️ Odpowiedzi na wiadomości — przycisk przy hover, pasek "Odpowiadasz X" nad polem wpisywania, cytowanie widoczne w wiadomości' },
      { type: 'new',  text: '⌨️ Wskaźnik pisania — animowane kropki i "X pisze..." gdy ktoś wpisuje tekst' },
      { type: 'fix',  text: 'Udostępnianie ekranu naprawione — nowy mechanizm zgodny z Electron 31+' },
    ],
  },
  {
    version: '0.5.9',
    date: '2026-05-04',
    label: '',
    entries: [
      { type: 'fix',  text: 'Udostępnianie ekranu naprawione — nowy mechanizm zgodny z Electron 31+ (setDisplayMediaRequestHandler)' },
    ],
  },
  {
    version: '0.5.8',
    date: '2026-05-03',
    label: '',
    entries: [
      { type: 'new',  text: 'Pasek kanałów — gdy kanałów za dużo, zawijają się do kolejnej linii zamiast wyjeżdżać poza ekran' },
      { type: 'fix',  text: 'Przycisk "Opublikuj post" w forum — był nieaktywny przy pustej treści bez żadnego komunikatu; teraz wyświetla błąd' },
    ],
  },
  {
    version: '0.5.7',
    date: '2026-05-02',
    label: '',
    entries: [
      { type: 'fix',  text: 'Przycisk "Opublikuj post" w forum — przycisk nie był kliknięty gdy pole treści było puste (brak wizualnego komunikatu o błędzie); teraz pokazuje komunikat' },
    ],
  },
  {
    version: '0.5.6',
    date: '2026-05-01',
    label: '',
    entries: [
      { type: 'fix',  text: 'Forum naprawione — zapytania do bazy używają teraz pool.query() zamiast prepared statements, co eliminuje błąd 500 na Railway' },
      { type: 'fix',  text: 'GIF-y działają stabilnie — Tenor v1 API z poprawnym formatem odpowiedzi' },
    ],
  },
  {
    version: '0.5.5',
    date: '2026-04-29',
    label: '',
    entries: [
      { type: 'fix',  text: 'GIF-y działają poprawnie — zmieniono API Tenor z v2 na v1 (g.tenor.com), które zwraca dane w prawidłowym formacie' },
      { type: 'fix',  text: 'Forum naprawione — tabele forum_posts i forum_replies tworzone jawnie przy każdym starcie serwera, niezależnie od schema.sql' },
    ],
  },
  {
    version: '0.5.4',
    date: '2026-04-28',
    label: '',
    entries: [
      { type: 'fix',  text: 'GIF-y działają w Electronie — requesty przechodzą przez serwer backend zamiast bezpośrednio do Tenor (omijanie blokady CORS/TLS)' },
      { type: 'fix',  text: 'Posty forum wyświetlają się poprawnie — naprawiono sortowanie dla nowych postów bez odpowiedzi' },
      { type: 'imp',  text: 'Forum pokazuje teraz komunikat błędu z przyciskiem "Spróbuj ponownie" zamiast cichej pustej listy' },
    ],
  },
  {
    version: '0.5.3',
    date: '2026-04-27',
    label: '',
    entries: [
      { type: 'fix',  text: 'GIF-y działają ponownie — zmieniono dostawcę z Giphy (wycofany klucz publiczny) na Tenor (Google)' },
      { type: 'imp',  text: 'Picker GIF-ów w czacie i forum korzysta z Tenor API — stabilniejszy, bez limitów dla normalnego użycia' },
    ],
  },
  {
    version: '0.5.2',
    date: '2026-04-24',
    label: '',
    entries: [
      { type: 'fix',  text: 'Ustawienia → Konto: numer wersji aplikacji (np. v0.5.2) widoczny od razu, bez konieczności klikania przycisku' },
      { type: 'fix',  text: 'Picker wyboru okna do stream — okno modalne wyrenderowane przez portal, zawsze na środku ekranu bez chowania się za innymi elementami' },
      { type: 'fix',  text: 'Przycisk "Udostępnij ekran" w widoku kanału głosowego otwiera teraz picker okien tak samo jak przycisk w dolnym docku' },
    ],
  },
  {
    version: '0.5.1',
    date: '2026-04-22',
    label: '',
    entries: [
      { type: 'new',  text: 'Picker okien przy udostępnianiu ekranu — zamiast całego ekranu możesz wybrać konkretne okno lub monitor z podglądem miniatur' },
      { type: 'new',  text: 'Przycisk GIF w polu wiadomości — wbudowana wyszukiwarka Giphy (trendy + wyszukiwanie), GIF wysyłany jednym kliknięciem' },
      { type: 'imp',  text: 'GIF-y wysłane przez czat wyświetlają się jako obrazek (nie gołe URL), maks. 256px wysokości z zaokrąglonymi rogami' },
    ],
  },
  {
    version: '0.5.0',
    date: '2026-04-20',
    label: '',
    entries: [
      { type: 'new',  text: 'Forum przebudowane od podstaw — posty, wątki i odpowiedzi jak na Discordzie, zupełnie nowy interfejs z kartami postów' },
      { type: 'new',  text: 'Wsparcie GIF w forum — wbudowana wyszukiwarka Giphy w oknie tworzenia postów i odpowiedzi' },
      { type: 'new',  text: 'Podgląd GIF w odpowiedziach — miniatura przed wysłaniem z możliwością usunięcia' },
      { type: 'imp',  text: 'Licznik odpowiedzi i data ostatniej aktywności widoczne bezpośrednio na karcie posta' },
      { type: 'imp',  text: 'Pasek wyszukiwania postów w widoku forum — filtruje lokalnie po tytule i treści' },
    ],
  },
  {
    version: '0.4.9',
    date: '2026-04-14',
    label: '',
    entries: [
      { type: 'new',  text: 'Kanały Forum — nowy typ kanału (🗂) przeznaczony na wątki i dyskusje, dostępny w ustawieniach serwera i szybkim tworzeniu' },
      { type: 'new',  text: 'Przycisk „Sprawdź aktualizacje" w Ustawieniach → Konto — wyświetla status i komunikat błędu jeśli aktualizacja nie powiedzie się' },
      { type: 'imp',  text: 'Automatyczna aktualizacja działa poprawnie na Windows z antywirusem przechwytującym TLS (naprawa NODE_TLS_REJECT_UNAUTHORIZED)' },
      { type: 'imp',  text: 'Baner aktualizacji pojawia się niezawodnie — zdarzenie jest buforowane do momentu załadowania strony' },
      { type: 'fix',  text: 'Wyszukiwanie wiadomości (Ctrl+F) — naprawiono brak wyników dla starszych wiadomości (server_id był NULL w bazie)' },
      { type: 'fix',  text: 'Usunięto zbędny przycisk „Zastosuj motyw i tryb" — ustawienia zapisują się automatycznie przy każdej zmianie' },
    ],
  },
  {
    version: '0.4.1',
    date: '2026-04-12',
    label: '',
    entries: [
      { type: 'new',  text: 'Wyszukiwanie wiadomości (Ctrl+F) — przeszukuje wszystkie kanały serwera z podświetlaniem frazy i przejściem do wiadomości' },
      { type: 'new',  text: 'Auto-updater — aplikacja wykrywa nowe wersje przy starcie i oferuje pobranie w tle bez przerywania pracy' },
      { type: 'new',  text: 'Odznaka ⚡ Dev przy nicku dewelopera platformy' },
      { type: 'fix',  text: 'Przesyłanie logo serwera — naprawiono błąd bazy danych (zła nazwa kolumny, za mały typ danych VARCHAR→MEDIUMTEXT)' },
      { type: 'fix',  text: 'Logo serwera widoczne wszędzie — ujednolicono nazwę pola icon_url w całym frontendzie' },
    ],
  },
  {
    version: '0.4.0',
    date: '2026-04-05',
    label: '',
    entries: [
      { type: 'new',  text: '8 motywów kolorystycznych — Ember, Ocean, Forest, Purple, Rose, Midnight, Sunset, Arctic — zmiana na żywo bez restartu' },
      { type: 'new',  text: 'Zakładka „Co nowego" z pełną historią zmian w aplikacji' },
      { type: 'imp',  text: 'Rozmiar tekstu (Mały 14px / Normalny 16px / Duży 18px) zmienia się natychmiast bez restartu' },
      { type: 'imp',  text: 'Tryb kompaktowy — mniejsze odstępy między wiadomościami, działa w czasie rzeczywistym' },
      { type: 'fix',  text: 'Push-to-Talk — naprawiono brak działania skrótu PTT po ponownym uruchomieniu aplikacji' },
      { type: 'fix',  text: 'Moderator może teraz przypisywać rangi Członek i Do Weryfikacji (nie może dawać Moderatora/Administratora)' },
      { type: 'fix',  text: 'Zdjęcia profilowe nie znikają po restarcie aplikacji (błąd w polu avatarUrl→avatar)' },
      { type: 'fix',  text: 'Status (DND, Zaraz wracam itp.) aktualizuje się natychmiast w panelu członków u wszystkich' },
      { type: 'fix',  text: 'Usunięto profil audio 96/128 kbps — zbyt duże zużycie pasma bez zauważalnej różnicy' },
      { type: 'fix',  text: 'Usunięto wyświetlanie bitrate przy dołączaniu do kanałów głosowych' },
    ],
  },
  {
    version: '0.3.0',
    date: '2026-03-25',
    label: '',
    entries: [
      { type: 'new',  text: 'Szybkie nadawanie rangi z menu kontekstowego (⋮) przy każdym członku' },
      { type: 'new',  text: 'Hierarchia ról — Moderator nie może moderować, wyciszyć ani zbanować Administratora' },
      { type: 'imp',  text: 'Ranga pojawia się natychmiast po nadaniu — bez odświeżania strony' },
      { type: 'imp',  text: 'Kanały odblokowują się natychmiast po zmianie roli bez restartu' },
      { type: 'fix',  text: 'Dołączanie przez link zaproszenia — nowy członek pojawia się natychmiast u wszystkich (brakowało zdarzenia MEMBER_JOIN)' },
      { type: 'fix',  text: 'Nakładka głosowa (Alt+Shift+O) — nie znikała po ponownym wywołaniu skrótu' },
      { type: 'fix',  text: 'Menu kontekstowe rangi nie zamykało się przy kliknięciu wewnątrz listy' },
      { type: 'fix',  text: 'Menu kontekstowe było przykrywane przez inne wiersze — naprawiono przez portal z position:fixed' },
      { type: 'fix',  text: 'Ładowanie... zamiast listy rang — brakowało endpointu GET /api/servers/:id/roles' },
    ],
  },
  {
    version: '0.2.1',
    date: '2026-03-12',
    label: '',
    entries: [
      { type: 'new',  text: 'Nakładka głosowa w grze — wyświetla uczestników kanału z animacją mówienia' },
      { type: 'new',  text: 'Skrót Alt+Shift+O do pokazania/ukrycia nakładki' },
      { type: 'new',  text: 'Instalator NSIS — pełny instalator Windows z uiohook-napi' },
      { type: 'new',  text: 'Globalne PTT przez mysz za pomocą uiohook-napi (przycisk myszy jako Push-to-Talk)' },
      { type: 'imp',  text: 'Nakładka przez IPC zamiast BroadcastChannel — stabilniejsza komunikacja między procesami' },
      { type: 'imp',  text: 'Manifest UAC requireAdministrator dla electron.exe — wymagane do globalnych skrótów' },
      { type: 'fix',  text: 'Wyrzucanie członków — brakowało zdarzenia MEMBER_LEAVE, panel nie odświeżał listy' },
      { type: 'fix',  text: 'Crash przy wyrzucaniu członka z ustawień serwera' },
      { type: 'fix',  text: 'Aktualizacje obecności (online/offline) w czasie rzeczywistym' },
      { type: 'fix',  text: 'Podwójny update store przy dołączaniu/opuszczaniu serwera' },
    ],
  },
  {
    version: '0.2.0',
    date: '2026-03-01',
    label: '',
    entries: [
      { type: 'new',  text: 'Aplikacja desktopowa Electron (Windows) — pierwsza wersja .exe' },
      { type: 'new',  text: 'Push-to-Talk z przyciskiem myszy' },
      { type: 'new',  text: 'Ulepszony UI wyboru klawisza PTT' },
      { type: 'imp',  text: 'Wyłączenie throttlingu Chromium w tle — naprawia brak dźwięku podczas grania' },
      { type: 'imp',  text: 'Automatyczne przyznawanie uprawnień do mikrofonu w Electronie' },
      { type: 'fix',  text: 'Mikrofon USB nie nadawał dźwięku przy dołączaniu do kanału' },
      { type: 'fix',  text: 'Deadlock VAD powodujący brak dźwięku przy starcie' },
      { type: 'fix',  text: 'Błąd „Requested device not found" przy ponownym dołączaniu do kanału' },
      { type: 'fix',  text: 'Pre-warm getUserMedia przed LiveKit — stabilniejsze połączenie mikrofonu' },
      { type: 'fix',  text: 'Utknięty pokój LiveKit po rozłączeniu — usuwa pusty pokój przy dołączaniu' },
      { type: 'fix',  text: 'Rate limiter blokował wszystkich użytkowników — brak trust proxy na Railway' },
    ],
  },
  {
    version: '0.1.1',
    date: '2026-02-14',
    label: '',
    entries: [
      { type: 'new',  text: 'Autouzupełnianie @wzmianek z wyszukiwaniem, strzałkami, @everyone i @here' },
      { type: 'new',  text: 'Zdarzenia MEMBER_JOIN/MEMBER_LEAVE — lista członków aktualizuje się na żywo' },
      { type: 'new',  text: 'Odznaka Dev (⚡) dla deweloperów — kolumna is_dev + zmienna DEV_USERNAMES' },
      { type: 'new',  text: 'Baner informacyjny na stronach logowania (tryb testowy/produkcja)' },
      { type: 'imp',  text: 'Podgląd niestandardowego statusu i aktualizacje profilu w czasie rzeczywistym' },
      { type: 'fix',  text: 'Avatar znikał po wysłaniu wiadomości — unieważnienie cache profilu' },
      { type: 'fix',  text: 'Podwójny @@ w autouzupełnianiu wzmianek' },
      { type: 'fix',  text: 'avatar_url zmieniony z VARCHAR(512) na MEDIUMTEXT — obsługa base64' },
      { type: 'fix',  text: 'Migracje uruchamiają się automatycznie przy starcie serwera' },
      { type: 'fix',  text: 'Poprawki deploymentu Railway — DB_NAME, trust proxy, healthcheck' },
    ],
  },
  {
    version: '0.1.0',
    date: '2026-02-01',
    label: 'Pierwsze wydanie',
    entries: [
      { type: 'new',  text: 'Serwery z kanałami tekstowymi, głosowymi, ogłoszeniowymi i forum' },
      { type: 'new',  text: 'System ról i uprawnień (Administrator, Moderator, Członek, Do Weryfikacji)' },
      { type: 'new',  text: 'Wyciszanie, wyrzucanie i banowanie członków z potwierdzeniem' },
      { type: 'new',  text: 'Powiadomienia — wzmianki, odpowiedzi, reakcje z szybką odpowiedzią' },
      { type: 'new',  text: 'Własne emoji serwera (do 50 sztuk)' },
      { type: 'new',  text: 'Połączenia głosowe przez LiveKit — VAD, Push-to-Talk, wyciszanie, deafen' },
      { type: 'new',  text: 'Udostępnianie ekranu i kamera w kanałach głosowych' },
      { type: 'new',  text: 'Linki zaproszenia do serwerów' },
      { type: 'new',  text: 'Ustawienia profilu — avatar, status, kolor, niestandardowy status' },
      { type: 'new',  text: 'Ustawienia audio — urządzenie, głośność, VAD, PTT, profil jakości' },
      { type: 'new',  text: 'Panel administracyjny dla deweloperów' },
    ],
  },
]

const ENTRY_META = {
  new: { color: '#22c55e', label: 'Nowość',   bg: 'rgba(34,197,94,0.1)'  },
  fix: { color: '#60a5fa', label: 'Naprawa',  bg: 'rgba(96,165,250,0.1)' },
  imp: { color: '#f59e0b', label: 'Poprawa',  bg: 'rgba(245,158,11,0.1)' },
}

function PatchNotes() {
  return (
    <div className="pt-2 flex flex-col gap-4">
      {PATCH_NOTES.map(release => (
        <div key={release.version}>
          {}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ background: 'var(--eb-gradient)', color: '#fff' }}>
              v{release.version}
            </span>
            {release.label && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '0.5px solid rgba(34,197,94,0.3)' }}>
                {release.label}
              </span>
            )}
            <span className="text-[10px] ml-auto" style={{ color: 'var(--eb-text3)' }}>{release.date}</span>
          </div>

          {}
          <div className="flex flex-col gap-1.5 pl-1">
            {release.entries.map((entry, i) => {
              const meta = ENTRY_META[entry.type as keyof typeof ENTRY_META] ?? ENTRY_META.new
              return (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded mt-0.5 flex-shrink-0"
                    style={{ background: meta.bg, color: meta.color }}>
                    {meta.label}
                  </span>
                  <span className="text-[11px] leading-snug" style={{ color: 'var(--eb-text2)' }}>
                    {entry.text}
                  </span>
                </div>
              )
            })}
          </div>

          <div className="mt-3 h-px" style={{ background: 'var(--eb-border)' }} />
        </div>
      ))}
    </div>
  )
}

const NOTIF_META: Record<NotifType, { color: string; label: string; icon: string }> = {
  mention:  { color: '#f87171', label: 'Oznaczenie', icon: '@' },
  reply:    { color: '#4a9eff', label: 'Odpowiedź',  icon: '↩' },
  reaction: { color: '#f59e0b', label: 'Reakcja',    icon: '😄' },
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

  async function markReadAndSwitch(id: string) {
    await markRead(id)
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

  function sendReply(notif: Notification) {
    if (!replyText.trim()) return
    socket.sendMessage(notif.channel_id, notif.server_id, replyText.trim(), undefined, notif.message_id)
    markRead(notif.id)
    setReplyingTo(null)
    setReplyText('')
    setActiveTab('all')
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
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="text-[10px] transition-opacity hover:opacity-70"
              style={{ color: 'var(--eb-voice)' }}>
              {t('notif.markAllRead')}
            </button>
          )}
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
          const meta = NOTIF_META[notif.type]
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
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-xs"
                    style={{ background: notif.author_avatar_color }}>
                    {notif.author_name.slice(0, 1)}
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold"
                    style={{ background: meta.color, border: '1.5px solid var(--eb-bg1)', color: '#fff' }}>
                    {meta.icon}
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-xs font-semibold truncate" style={{ color: 'var(--eb-text1)' }}>
                      {notif.author_name}
                    </span>
                    <span className="text-[9px] font-medium px-1.5 py-px rounded-full flex-shrink-0"
                      style={{ background: `${meta.color}22`, color: meta.color }}>
                      {meta.label}
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
