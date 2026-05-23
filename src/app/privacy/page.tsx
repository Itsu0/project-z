import Link from 'next/link'

export const metadata = {
  title: 'Polityka prywatności — Nexus',
  description: 'Polityka prywatności platformy Nexus',
}

export default function PrivacyPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#0f0a0f', color: '#f1f5f9' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '48px 24px 80px' }}>

        <div style={{ marginBottom: 40 }}>
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: '#94a3b8', fontSize: 14, textDecoration: 'none', marginBottom: 32 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            Powrót
          </Link>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg,#dc2626,#f59e0b)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 22, color: '#fff', flexShrink: 0 }}>N</div>
            <div>
              <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, letterSpacing: -0.5 }}>Polityka prywatności</h1>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>Nexus · Ostatnia aktualizacja: maj 2026</p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 32, lineHeight: 1.7 }}>

          <section>
            <h2 style={h2}>1. Administrator danych</h2>
            <p style={p}>Administratorem Twoich danych osobowych jest operator platformy Nexus (project-z.cloud). Kontakt w sprawach dotyczących danych osobowych: <a href="mailto:kontakt@project-z.cloud" style={link}>kontakt@project-z.cloud</a></p>
          </section>

          <section>
            <h2 style={h2}>2. Jakie dane zbieramy</h2>
            <ul style={ul}>
              <li style={li}><strong style={{ color: '#f1f5f9' }}>Dane rejestracyjne:</strong> adres e-mail, nazwa użytkownika, hasło (przechowywane w postaci skrótu bcrypt), wyświetlana nazwa, kolor avatara.</li>
              <li style={li}><strong style={{ color: '#f1f5f9' }}>Dane profilu:</strong> własny status, avatar (opcjonalnie), preferencje powiadomień.</li>
              <li style={li}><strong style={{ color: '#f1f5f9' }}>Treści:</strong> wiadomości, pliki, reakcje wysyłane przez Ciebie na Platformie.</li>
              <li style={li}><strong style={{ color: '#f1f5f9' }}>Dane techniczne:</strong> adres IP (do celów bezpieczeństwa i weryfikacji tożsamości), logi błędów.</li>
              <li style={li}><strong style={{ color: '#f1f5f9' }}>Dane aktywności:</strong> czas ostatniego logowania, status online/offline.</li>
            </ul>
          </section>

          <section>
            <h2 style={h2}>3. Cel i podstawa przetwarzania</h2>
            <p style={p}>Dane przetwarzamy w następujących celach:</p>
            <ul style={ul}>
              <li style={li}><strong style={{ color: '#f1f5f9' }}>Świadczenie usługi</strong> (art. 6 ust. 1 lit. b RODO) — umożliwienie komunikacji, zarządzania serwerami, obsługi konta.</li>
              <li style={li}><strong style={{ color: '#f1f5f9' }}>Bezpieczeństwo</strong> (art. 6 ust. 1 lit. f RODO) — wykrywanie nadużyć, ataków, nieautoryzowanego dostępu.</li>
              <li style={li}><strong style={{ color: '#f1f5f9' }}>Weryfikacja e-mail</strong> (art. 6 ust. 1 lit. b RODO) — potwierdzenie własności adresu e-mail przy rejestracji.</li>
              <li style={li}><strong style={{ color: '#f1f5f9' }}>Komunikacja</strong> (art. 6 ust. 1 lit. b RODO) — wysyłanie powiadomień transakcyjnych (weryfikacja e-mail, hasło).</li>
            </ul>
          </section>

          <section>
            <h2 style={h2}>4. Przechowywanie danych</h2>
            <p style={p}>Dane konta przechowujemy przez czas istnienia konta. Po usunięciu konta dane są usuwane niezwłocznie, z wyjątkiem danych wymaganych przepisami prawa lub niezbędnych do rozwiązania sporów.</p>
            <p style={p}>Wiadomości na serwerach mogą pozostać widoczne dla innych członków po usunięciu konta, chyba że właściciel serwera je usunie.</p>
            <p style={p}>Platforma jest w fazie testów beta — dane mogą zostać zresetowane bez uprzedzenia.</p>
          </section>

          <section>
            <h2 style={h2}>5. Udostępnianie danych</h2>
            <p style={p}>Nie sprzedajemy Twoich danych osobowych. Dane mogą być udostępniane:</p>
            <ul style={ul}>
              <li style={li}><strong style={{ color: '#f1f5f9' }}>Dostawcy infrastruktury</strong> — serwery VPS (OVH, Hetzner) i hosting frontendowy (Vercel) przetwarzają dane wyłącznie w celu świadczenia usługi.</li>
              <li style={li}><strong style={{ color: '#f1f5f9' }}>Dostawca e-mail</strong> — usługa SMTP używana do wysyłania wiadomości weryfikacyjnych.</li>
              <li style={li}><strong style={{ color: '#f1f5f9' }}>Organy prawne</strong> — gdy jest to wymagane przez obowiązujące przepisy.</li>
            </ul>
          </section>

          <section>
            <h2 style={h2}>6. Pliki cookies i dane lokalne</h2>
            <p style={p}>Platforma korzysta z <strong style={{ color: '#f1f5f9' }}>localStorage</strong> przeglądarki do przechowywania tokenu sesji JWT. Token ten jest niezbędny do utrzymania stanu zalogowania.</p>
            <p style={p}>Nie używamy cookies śledzących ani reklamowych.</p>
          </section>

          <section>
            <h2 style={h2}>7. Twoje prawa</h2>
            <p style={p}>Zgodnie z RODO przysługują Ci następujące prawa:</p>
            <ul style={ul}>
              <li style={li}><strong style={{ color: '#f1f5f9' }}>Dostęp</strong> — prawo do uzyskania informacji o przetwarzanych danych.</li>
              <li style={li}><strong style={{ color: '#f1f5f9' }}>Sprostowanie</strong> — prawo do poprawienia nieprawidłowych danych.</li>
              <li style={li}><strong style={{ color: '#f1f5f9' }}>Usunięcie</strong> — prawo do żądania usunięcia danych („prawo do bycia zapomnianym").</li>
              <li style={li}><strong style={{ color: '#f1f5f9' }}>Ograniczenie</strong> — prawo do ograniczenia przetwarzania.</li>
              <li style={li}><strong style={{ color: '#f1f5f9' }}>Przenoszalność</strong> — prawo do otrzymania danych w ustrukturyzowanym formacie.</li>
              <li style={li}><strong style={{ color: '#f1f5f9' }}>Sprzeciw</strong> — prawo do sprzeciwu wobec przetwarzania opartego na prawnie uzasadnionym interesie.</li>
            </ul>
            <p style={p}>Aby skorzystać z tych praw, napisz na <a href="mailto:kontakt@project-z.cloud" style={link}>kontakt@project-z.cloud</a>.</p>
          </section>

          <section>
            <h2 style={h2}>8. Bezpieczeństwo danych</h2>
            <p style={p}>Stosujemy następujące środki ochrony danych:</p>
            <ul style={ul}>
              <li style={li}>Hasła przechowywane wyłącznie jako skróty bcrypt (koszt 12).</li>
              <li style={li}>Komunikacja szyfrowana TLS/HTTPS.</li>
              <li style={li}>Tokeny JWT z krótkim czasem życia.</li>
              <li style={li}>Ograniczenie dostępu do bazy danych tylko z serwerów aplikacji.</li>
              <li style={li}>Monitorowanie podejrzanej aktywności (ban IP, rate limiting).</li>
            </ul>
          </section>

          <section>
            <h2 style={h2}>9. Dzieci</h2>
            <p style={p}>Platforma nie jest przeznaczona dla osób poniżej 13 roku życia. Jeśli dowiesz się, że dziecko poniżej 13 lat utworzyło konto, prosimy o kontakt w celu jego usunięcia.</p>
          </section>

          <section>
            <h2 style={h2}>10. Zmiany Polityki prywatności</h2>
            <p style={p}>Możemy aktualizować niniejszą Politykę. O istotnych zmianach poinformujemy e-mailem lub komunikatem w aplikacji. Data ostatniej aktualizacji widnieje na górze strony.</p>
          </section>

          <section>
            <h2 style={h2}>11. Kontakt i skargi</h2>
            <p style={p}>Pytania dotyczące prywatności: <a href="mailto:kontakt@project-z.cloud" style={link}>kontakt@project-z.cloud</a></p>
            <p style={p}>Masz prawo wnieść skargę do Prezesa Urzędu Ochrony Danych Osobowych (UODO) pod adresem: ul. Stawki 2, 00-193 Warszawa, <a href="https://uodo.gov.pl" target="_blank" rel="noreferrer" style={link}>uodo.gov.pl</a>.</p>
          </section>

        </div>

        <div style={{ marginTop: 48, paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <Link href="/terms" style={link}>Regulamin</Link>
          <Link href="/" style={{ ...link, color: '#64748b' }}>Powrót do Nexusa</Link>
        </div>

      </div>
    </div>
  )
}

const h2: React.CSSProperties = {
  margin: '0 0 12px',
  fontSize: 18,
  fontWeight: 600,
  color: '#f1f5f9',
}
const p: React.CSSProperties = {
  margin: '0 0 10px',
  fontSize: 14,
  color: '#94a3b8',
}
const ul: React.CSSProperties = {
  margin: '0 0 10px',
  paddingLeft: 20,
}
const li: React.CSSProperties = {
  fontSize: 14,
  color: '#94a3b8',
  marginBottom: 6,
}
const link: React.CSSProperties = {
  color: '#f59e0b',
  textDecoration: 'none',
}
