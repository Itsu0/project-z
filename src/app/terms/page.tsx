import Link from 'next/link'

export const metadata = {
  title: 'Regulamin — Nexus',
  description: 'Regulamin korzystania z platformy Nexus',
}

export default function TermsPage() {
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
              <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, letterSpacing: -0.5 }}>Regulamin</h1>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>Nexus · Ostatnia aktualizacja: maj 2026</p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 32, lineHeight: 1.7 }}>

          <section>
            <h2 style={h2}>1. Definicje</h2>
            <p style={p}><strong>Nexus</strong> (dalej: „Platforma") — usługa komunikacji online dostępna pod adresem project-z.cloud, umożliwiająca tworzenie serwerów, kanałów tekstowych i głosowych oraz wymianę wiadomości w czasie rzeczywistym.</p>
            <p style={p}><strong>Użytkownik</strong> — każda osoba fizyczna, która ukończyła 13 lat, zarejestrowała konto i korzysta z Platformy.</p>
            <p style={p}><strong>Serwer</strong> — przestrzeń tworzona przez Użytkowników, zawierająca kanały i grono członków.</p>
            <p style={p}><strong>Treści</strong> — wszelkie materiały publikowane przez Użytkowników: wiadomości, pliki, obrazy, reakcje.</p>
          </section>

          <section>
            <h2 style={h2}>2. Akceptacja Regulaminu</h2>
            <p style={p}>Korzystanie z Platformy jest równoznaczne z akceptacją niniejszego Regulaminu oraz <Link href="/privacy" style={link}>Polityki prywatności</Link>. Jeśli nie akceptujesz tych warunków, nie korzystaj z Platformy.</p>
            <p style={p}>Platforma jest w fazie testów beta. Dane mogą zostać zresetowane bez uprzedniego powiadomienia. Korzystasz z niej na własne ryzyko.</p>
          </section>

          <section>
            <h2 style={h2}>3. Konto i bezpieczeństwo</h2>
            <ul style={ul}>
              <li style={li}>Musisz mieć ukończone 13 lat, aby korzystać z Nexusa.</li>
              <li style={li}>Jesteś odpowiedzialny/a za utrzymanie poufności hasła do swojego konta.</li>
              <li style={li}>Każda osoba może posiadać jedno konto. Zakładanie wielu kont w celu obejścia blokad jest zabronione.</li>
              <li style={li}>Niezwłocznie poinformuj nas o nieautoryzowanym dostępie do Twojego konta.</li>
              <li style={li}>Adres e-mail musi być weryfikowalny i należeć do Ciebie.</li>
            </ul>
          </section>

          <section>
            <h2 style={h2}>4. Zasady korzystania</h2>
            <p style={p}>Zabrania się:</p>
            <ul style={ul}>
              <li style={li}>publikowania treści nielegalnych, pornograficznych (jeśli serwer nie ma stosownej weryfikacji wiekowej), nawołujących do przemocy lub nienawiści na tle rasowym, etnicznym, płciowym, religijnym lub seksualnym;</li>
              <li style={li}>nękania, prześladowania i grożenia innym użytkownikom;</li>
              <li style={li}>rozsyłania spamu, złośliwego oprogramowania lub linków phishingowych;</li>
              <li style={li}>podszywania się pod inne osoby lub instytucje;</li>
              <li style={li}>prób uzyskania nieautoryzowanego dostępu do serwerów lub kont innych użytkowników;</li>
              <li style={li}>nadmiernego obciążania infrastruktury (ataki DDoS, flood);</li>
              <li style={li}>automatyzacji konta bez naszej zgody (boty, scraping).</li>
            </ul>
          </section>

          <section>
            <h2 style={h2}>5. Treści użytkowników</h2>
            <p style={p}>Zachowujesz prawa do treści, które publikujesz na Platformie. Udzielasz nam niewyłącznej, bezpłatnej licencji na przechowywanie i wyświetlanie tych treści w ramach świadczenia usługi.</p>
            <p style={p}>Masz pełną odpowiedzialność za publikowane treści. Nie monitorujemy prewencyjnie treści, ale reagujemy na zgłoszenia naruszeń.</p>
            <p style={p}>Treści naruszające niniejszy Regulamin mogą być usuwane bez uprzedzenia. Wielokrotne naruszenia skutkują blokadą konta.</p>
          </section>

          <section>
            <h2 style={h2}>6. Serwery i moderacja</h2>
            <p style={p}>Właściciel serwera jest odpowiedzialny za treści publikowane na jego serwerze. Narzędzia moderacji (mute, ban, automod) służą do utrzymania porządku i powinny być stosowane zgodnie z ich przeznaczeniem.</p>
            <p style={p}>Zastrzegamy sobie prawo do usunięcia serwerów naruszających Regulamin bez uprzedzenia.</p>
          </section>

          <section>
            <h2 style={h2}>7. Dostępność usługi</h2>
            <p style={p}>Platforma jest udostępniana „tak jak jest" i „w miarę dostępności". Nie gwarantujemy ciągłości działania, szczególnie w fazie testów beta. Nie ponosimy odpowiedzialności za szkody wynikłe z niedostępności Platformy lub utraty danych.</p>
          </section>

          <section>
            <h2 style={h2}>8. Zmiany Regulaminu</h2>
            <p style={p}>Możemy zmieniać Regulamin w dowolnym czasie. O istotnych zmianach poinformujemy z wyprzedzeniem (e-mail lub komunikat w aplikacji). Dalsze korzystanie z Platformy po wejściu zmian w życie oznacza ich akceptację.</p>
          </section>

          <section>
            <h2 style={h2}>9. Zakończenie konta</h2>
            <p style={p}>Możesz usunąć swoje konto w dowolnym momencie. Zastrzegamy sobie prawo do zawieszenia lub usunięcia konta naruszającego Regulamin, bez obowiązku zwrotu opłat (jeśli dotyczy).</p>
          </section>

          <section>
            <h2 style={h2}>10. Prawo właściwe</h2>
            <p style={p}>Regulamin podlega prawu polskiemu. Wszelkie spory rozpatrywane są przez sądy właściwe dla siedziby operatora Platformy.</p>
          </section>

          <section>
            <h2 style={h2}>11. Kontakt</h2>
            <p style={p}>Pytania dotyczące Regulaminu kieruj na adres: <a href="mailto:kontakt@project-z.cloud" style={link}>kontakt@project-z.cloud</a></p>
          </section>

        </div>

        <div style={{ marginTop: 48, paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <Link href="/privacy" style={link}>Polityka prywatności</Link>
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
