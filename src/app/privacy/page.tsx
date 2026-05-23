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
            <h2 style={h2}>1. Administrator danych osobowych</h2>
            <p style={p}>
              Administratorem Twoich danych osobowych jest operator platformy Nexus prowadzący projekt
              pod adresem <strong>project-z.cloud</strong> (dalej: „Administrator").
            </p>
            <p style={p}>
              Kontakt z Administratorem w sprawach ochrony danych osobowych:{' '}
              <a href="mailto:kontakt@project-z.cloud" style={link}>kontakt@project-z.cloud</a>
            </p>
            <p style={p}>
              <strong>Inspektor Ochrony Danych (IOD):</strong> Administrator nie wyznaczył Inspektora Ochrony Danych,
              gdyż nie jest do tego zobowiązany na podstawie art. 37 RODO (skala przetwarzania nie spełnia przesłanek obowiązku).
              Wszelkie pytania dotyczące ochrony danych kieruj bezpośrednio do Administratora.
            </p>
          </section>

          <section>
            <h2 style={h2}>2. Jakie dane zbieramy i w jakim celu</h2>
            <p style={p}>Zbieramy wyłącznie dane niezbędne do świadczenia Usługi:</p>
            <ul style={ul}>
              <li style={li}>
                <strong style={{ color: '#f1f5f9' }}>Dane rejestracyjne</strong> — adres e-mail, nazwa użytkownika,
                hasło (przechowywane wyłącznie jako skrót bcrypt, nigdy w postaci jawnej), wyświetlana nazwa, kolor avatara.
                <br/><span style={{ fontSize: 12, color: '#64748b' }}>Podstawa: art. 6 ust. 1 lit. b RODO (wykonanie umowy).</span>
              </li>
              <li style={li}>
                <strong style={{ color: '#f1f5f9' }}>Dane profilu</strong> — własny status, zdjęcie avatara (opcjonalnie, przesyłane dobrowolnie), preferencje interfejsu.
                <br/><span style={{ fontSize: 12, color: '#64748b' }}>Podstawa: art. 6 ust. 1 lit. b RODO.</span>
              </li>
              <li style={li}>
                <strong style={{ color: '#f1f5f9' }}>Treści użytkownika</strong> — wiadomości, pliki, reakcje wysyłane na Platformie.
                <br/><span style={{ fontSize: 12, color: '#64748b' }}>Podstawa: art. 6 ust. 1 lit. b RODO.</span>
              </li>
              <li style={li}>
                <strong style={{ color: '#f1f5f9' }}>Adres IP i dane techniczne</strong> — adres IP przy logowaniu i rejestracji, logi błędów serwera.
                Dane te służą do wykrywania nadużyć, ataków i nieautoryzowanego dostępu.
                <br/><span style={{ fontSize: 12, color: '#64748b' }}>Podstawa: art. 6 ust. 1 lit. f RODO (prawnie uzasadniony interes — bezpieczeństwo systemu). Okres retencji: 12 miesięcy.</span>
              </li>
              <li style={li}>
                <strong style={{ color: '#f1f5f9' }}>Dane aktywności</strong> — czas ostatniego logowania, status online/offline, historia połączeń głosowych (tylko czas trwania, bez nagrań).
                <br/><span style={{ fontSize: 12, color: '#64748b' }}>Podstawa: art. 6 ust. 1 lit. b RODO.</span>
              </li>
            </ul>
          </section>

          <section>
            <h2 style={h2}>3. Zautomatyzowane przetwarzanie i profilowanie</h2>
            <p style={p}>
              Platforma stosuje <strong>zautomatyzowane narzędzie moderacji treści (AutoMod)</strong>, które analizuje
              wiadomości pod kątem naruszenia zasad serwera i może automatycznie je blokować lub wyciszać konto użytkownika.
              Stanowi to zautomatyzowane podejmowanie decyzji w rozumieniu art. 22 RODO.
            </p>
            <p style={p}>
              Masz prawo do uzyskania interwencji człowieka w tej sprawie — skontaktuj się z Administratorem lub właścicielem serwera, na którym AutoMod podjął decyzję.
            </p>
            <p style={p}>
              Platforma <strong>nie profiluje</strong> użytkowników w celach reklamowych ani nie podejmuje innych zautomatyzowanych decyzji mających istotny wpływ na Twoje prawa.
            </p>
          </section>

          <section>
            <h2 style={h2}>4. Okres przechowywania danych</h2>
            <ul style={ul}>
              <li style={li}><strong style={{ color: '#f1f5f9' }}>Dane konta</strong> — przez czas istnienia konta. Po usunięciu konta dane są kasowane w ciągu 30 dni, z wyjątkiem danych wymaganych przepisami prawa lub niezbędnych do rozwiązania sporów.</li>
              <li style={li}><strong style={{ color: '#f1f5f9' }}>Wiadomości</strong> — do czasu usunięcia przez Ciebie lub właściciela serwera. Usunięcie konta nie kasuje automatycznie wiadomości wysłanych na serwerach osób trzecich.</li>
              <li style={li}><strong style={{ color: '#f1f5f9' }}>Adresy IP i logi bezpieczeństwa</strong> — maksymalnie 12 miesięcy.</li>
              <li style={li}><strong style={{ color: '#f1f5f9' }}>Tokeny weryfikacji e-mail</strong> — 24 godziny, następnie automatycznie usuwane.</li>
              <li style={li}><strong style={{ color: '#f1f5f9' }}>Logi moderacyjne</strong> — 90 dni, chyba że są potrzebne w związku z toczącym się postępowaniem.</li>
            </ul>
            <p style={p} style={{ color: '#64748b', fontSize: 13 }}>
              Platforma jest w fazie testów beta. Dane mogą zostać zresetowane z powodów technicznych po uprzednim powiadomieniu.
            </p>
          </section>

          <section>
            <h2 style={h2}>5. Odbiorcy danych — transfer do podmiotów trzecich</h2>
            <p style={p}>Nie sprzedajemy Twoich danych osobowych. Dane mogą być przekazywane wyłącznie:</p>
            <ul style={ul}>
              <li style={li}>
                <strong style={{ color: '#f1f5f9' }}>OVH SAS</strong> (Francja, EOG) — dostawca serwera VPS. Dane przetwarzane w UE.
              </li>
              <li style={li}>
                <strong style={{ color: '#f1f5f9' }}>Vercel Inc.</strong> (USA, poza EOG) — hosting frontendowy.
                Transfer odbywa się na podstawie standardowych klauzul umownych (SCC) zatwierdzonych przez Komisję Europejską
                (art. 46 ust. 2 lit. c RODO). Polityka prywatności Vercel:{' '}
                <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noreferrer" style={link}>vercel.com/legal/privacy-policy</a>.
              </li>
              <li style={li}>
                <strong style={{ color: '#f1f5f9' }}>Dostawca SMTP</strong> — usługa e-mail używana wyłącznie do wysyłania wiadomości transakcyjnych (weryfikacja konta, powiadomienia systemowe). Żadne treści wiadomości użytkowników nie są przekazywane dostawcy SMTP.
              </li>
              <li style={li}>
                <strong style={{ color: '#f1f5f9' }}>Organy publiczne</strong> — gdy jest to wymagane przez obowiązujące przepisy prawa.
              </li>
            </ul>
            <p style={p}>Żadne dane nie są przekazywane do krajów trzecich poza zakresem opisanym powyżej.</p>
          </section>

          <section>
            <h2 style={h2}>6. Pliki cookies i dane lokalne</h2>
            <p style={p}>
              Platforma <strong>nie używa plików cookies</strong> do śledzenia ani celów reklamowych.
              Token sesji (JWT) przechowywany jest wyłącznie w <strong>localStorage</strong> Twojej przeglądarki —
              nie jest wysyłany do nas automatycznie przy każdym żądaniu HTTP jak cookie, lecz dołączany świadomie przez aplikację.
            </p>
            <p style={p}>
              Nie stosujemy trackerów analitycznych (np. Google Analytics), pikseli reklamowych ani narzędzi do fingerprintingu przeglądarki.
            </p>
          </section>

          <section>
            <h2 style={h2}>7. Twoje prawa (RODO)</h2>
            <p style={p}>Zgodnie z RODO przysługują Ci następujące prawa. Aby z nich skorzystać, napisz na <a href="mailto:kontakt@project-z.cloud" style={link}>kontakt@project-z.cloud</a>. Odpowiemy w ciągu 30 dni:</p>
            <ul style={ul}>
              <li style={li}><strong style={{ color: '#f1f5f9' }}>Dostęp (art. 15)</strong> — prawo do uzyskania kopii przetwarzanych danych i informacji o przetwarzaniu.</li>
              <li style={li}><strong style={{ color: '#f1f5f9' }}>Sprostowanie (art. 16)</strong> — prawo do poprawienia nieprawidłowych lub uzupełnienia niekompletnych danych.</li>
              <li style={li}><strong style={{ color: '#f1f5f9' }}>Usunięcie (art. 17)</strong> — prawo do żądania usunięcia danych („prawo do bycia zapomnianym"), gdy nie są już niezbędne lub cofasz zgodę.</li>
              <li style={li}><strong style={{ color: '#f1f5f9' }}>Ograniczenie przetwarzania (art. 18)</strong> — prawo do żądania wstrzymania przetwarzania w określonych sytuacjach.</li>
              <li style={li}><strong style={{ color: '#f1f5f9' }}>Przenoszalność (art. 20)</strong> — prawo do otrzymania danych w ustrukturyzowanym, powszechnie stosowanym formacie (JSON).</li>
              <li style={li}><strong style={{ color: '#f1f5f9' }}>Sprzeciw (art. 21)</strong> — prawo do sprzeciwu wobec przetwarzania opartego na prawnie uzasadnionym interesie (art. 6 ust. 1 lit. f).</li>
              <li style={li}><strong style={{ color: '#f1f5f9' }}>Interwencja ludzka (art. 22)</strong> — prawo do zakwestionowania decyzji podjętej wyłącznie automatycznie (np. przez AutoMod).</li>
            </ul>
          </section>

          <section>
            <h2 style={h2}>8. Bezpieczeństwo danych</h2>
            <p style={p}>Stosujemy następujące środki ochrony danych:</p>
            <ul style={ul}>
              <li style={li}>Hasła przechowywane wyłącznie jako skróty bcrypt (koszt 12) — nigdy w formie jawnej.</li>
              <li style={li}>Cała komunikacja szyfrowana TLS 1.2+/HTTPS.</li>
              <li style={li}>Tokeny JWT podpisane kluczem HMAC-SHA256 z ograniczonym czasem ważności.</li>
              <li style={li}>Dostęp do bazy danych ograniczony do adresów IP serwerów aplikacji.</li>
              <li style={li}>Monitorowanie podejrzanej aktywności: ban IP, rate limiting, detekcja flood.</li>
              <li style={li}>Tokeny weryfikacji e-mail jednorazowego użytku, ważne 24 godziny.</li>
            </ul>
          </section>

          <section>
            <h2 style={h2}>9. Osoby niepełnoletnie</h2>
            <p style={p}>
              Platforma nie jest przeznaczona dla osób poniżej 13 roku życia.
              Osoby w wieku 13–15 lat mogą korzystać z Platformy wyłącznie za zgodą rodzica lub opiekuna prawnego,
              zgodnie z art. 8 RODO.
            </p>
            <p style={p}>
              Jeśli masz podstawy sądzić, że dziecko poniżej 13 lat posiada konto, skontaktuj się z nami pod adresem{' '}
              <a href="mailto:kontakt@project-z.cloud" style={link}>kontakt@project-z.cloud</a> — usuniemy konto niezwłocznie.
            </p>
          </section>

          <section>
            <h2 style={h2}>10. Zmiany Polityki prywatności</h2>
            <p style={p}>
              O istotnych zmianach tej Polityki poinformujemy e-mailem lub komunikatem w aplikacji z wyprzedzeniem
              co najmniej <strong>14 dni</strong> przed ich wejściem w życie.
              Data ostatniej aktualizacji widnieje na górze strony.
            </p>
          </section>

          <section>
            <h2 style={h2}>11. Skarga do organu nadzorczego</h2>
            <p style={p}>
              Jeśli uważasz, że przetwarzamy Twoje dane niezgodnie z prawem, masz prawo wnieść skargę do
              Prezesa Urzędu Ochrony Danych Osobowych (UODO):
            </p>
            <ul style={ul}>
              <li style={li}>Adres: ul. Stawki 2, 00-193 Warszawa</li>
              <li style={li}>Strona: <a href="https://uodo.gov.pl" target="_blank" rel="noreferrer" style={link}>uodo.gov.pl</a></li>
              <li style={li}>E-mail: <a href="mailto:kancelaria@uodo.gov.pl" style={link}>kancelaria@uodo.gov.pl</a></li>
            </ul>
            <p style={p}>Zachęcamy jednak do uprzedniego kontaktu z nami — postaramy się rozwiązać problem bezpośrednio.</p>
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

const h2: React.CSSProperties = { margin: '0 0 12px', fontSize: 18, fontWeight: 600, color: '#f1f5f9' }
const p:  React.CSSProperties = { margin: '0 0 10px', fontSize: 14, color: '#94a3b8' }
const ul: React.CSSProperties = { margin: '0 0 10px', paddingLeft: 20 }
const li: React.CSSProperties = { fontSize: 14, color: '#94a3b8', marginBottom: 8 }
const link: React.CSSProperties = { color: '#f59e0b', textDecoration: 'none' }
