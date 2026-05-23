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
            <h2 style={h2}>1. Dane operatora</h2>
            <p style={p}>
              Operatorem Platformy Nexus jest osoba fizyczna prowadząca projekt pod nazwą <strong>Nexus / project-z.cloud</strong>.
              Kontakt: <a href="mailto:kontakt@project-z.cloud" style={link}>kontakt@project-z.cloud</a>.
            </p>
            <p style={p}>
              Niniejszy Regulamin reguluje zasady świadczenia usług drogą elektroniczną w rozumieniu
              ustawy z dnia 18 lipca 2002 r. o świadczeniu usług drogą elektroniczną (Dz.U. 2002 nr 144 poz. 1204 z późn. zm.).
            </p>
          </section>

          <section>
            <h2 style={h2}>2. Definicje</h2>
            <p style={p}><strong>Nexus / Platforma</strong> — usługa komunikacji online dostępna pod adresem project-z.cloud, umożliwiająca tworzenie serwerów, kanałów tekstowych i głosowych oraz wymianę wiadomości w czasie rzeczywistym.</p>
            <p style={p}><strong>Użytkownik</strong> — każda osoba fizyczna, która ukończyła 16 lat (lub 13 lat za pisemną zgodą rodzica/opiekuna prawnego), zarejestrowała konto i korzysta z Platformy.</p>
            <p style={p}><strong>Serwer</strong> — przestrzeń tworzona przez Użytkowników, zawierająca kanały i grono członków.</p>
            <p style={p}><strong>Treści</strong> — wszelkie materiały publikowane przez Użytkowników: wiadomości, pliki, obrazy, reakcje.</p>
            <p style={p}><strong>Usługa</strong> — świadczona drogą elektroniczną usługa komunikacji i wymiany treści w ramach Platformy.</p>
          </section>

          <section>
            <h2 style={h2}>3. Akceptacja Regulaminu</h2>
            <p style={p}>Rejestracja konta jest równoznaczna z akceptacją niniejszego Regulaminu oraz <Link href="/privacy" style={link}>Polityki prywatności</Link>. Jeśli nie akceptujesz tych warunków, nie zakładaj konta ani nie korzystaj z Platformy.</p>
            <p style={p}>Platforma jest w fazie testów beta. Dane mogą zostać zresetowane po uprzednim powiadomieniu użytkowników (e-mail lub komunikat w aplikacji) z wyprzedzeniem min. 7 dni, chyba że reset jest konieczny z przyczyn technicznych lub bezpieczeństwa.</p>
          </section>

          <section>
            <h2 style={h2}>4. Konto i bezpieczeństwo</h2>
            <ul style={ul}>
              <li style={li}>Musisz mieć ukończone <strong>16 lat</strong>, aby samodzielnie korzystać z Nexusa. Osoby w wieku 13–15 lat mogą korzystać z Platformy wyłącznie za pisemną zgodą rodzica lub opiekuna prawnego.</li>
              <li style={li}>Jesteś odpowiedzialny/a za utrzymanie poufności hasła do swojego konta i za wszelkie działania podjęte z jego użyciem.</li>
              <li style={li}>Każda osoba może posiadać jedno aktywne konto. Zakładanie wielu kont w celu obejścia blokad jest zabronione.</li>
              <li style={li}>Niezwłocznie poinformuj nas o nieautoryzowanym dostępie do Twojego konta na adres <a href="mailto:kontakt@project-z.cloud" style={link}>kontakt@project-z.cloud</a>.</li>
              <li style={li}>Adres e-mail musi być weryfikowalny i należeć do Ciebie.</li>
            </ul>
          </section>

          <section>
            <h2 style={h2}>5. Zasady korzystania</h2>
            <p style={p}>Zabrania się:</p>
            <ul style={ul}>
              <li style={li}>publikowania treści nielegalnych, pornograficznych (jeśli serwer nie posiada stosownej weryfikacji wiekowej), nawołujących do przemocy lub nienawiści na tle rasowym, etnicznym, płciowym, religijnym lub seksualnym;</li>
              <li style={li}>nękania, prześladowania i grożenia innym użytkownikom;</li>
              <li style={li}>rozsyłania spamu, złośliwego oprogramowania lub linków phishingowych;</li>
              <li style={li}>podszywania się pod inne osoby lub instytucje;</li>
              <li style={li}>prób uzyskania nieautoryzowanego dostępu do serwerów lub kont innych użytkowników;</li>
              <li style={li}>nadmiernego obciążania infrastruktury (ataki DDoS, flood);</li>
              <li style={li}>automatyzacji konta bez naszej pisemnej zgody (boty, scraping).</li>
            </ul>
          </section>

          <section>
            <h2 style={h2}>6. Treści użytkowników</h2>
            <p style={p}>Zachowujesz wszelkie prawa do treści, które publikujesz na Platformie. Udzielasz nam niewyłącznej, bezpłatnej, odwołalnej licencji na przechowywanie i wyświetlanie tych treści <strong>wyłącznie w celu świadczenia Usługi i przez czas jej świadczenia</strong>. Licencja wygasa z chwilą usunięcia treści lub konta.</p>
            <p style={p}>Ponosisz pełną odpowiedzialność za publikowane treści. Nie monitorujemy prewencyjnie treści, ale reagujemy na zgłoszenia naruszeń w terminie do 14 dni roboczych.</p>
            <p style={p}>Treści naruszające niniejszy Regulamin mogą być usuwane bez uprzedzenia. O podjętym działaniu poinformujemy Cię e-mailem w ciągu 48 godzin. Wielokrotne naruszenia skutkują zawieszeniem lub usunięciem konta.</p>
          </section>

          <section>
            <h2 style={h2}>7. Serwery i moderacja</h2>
            <p style={p}>Właściciel serwera jest współodpowiedzialny za treści publikowane na jego serwerze. Narzędzia moderacji (wyciszenie, ban, automod) służą do utrzymania porządku zgodnie z niniejszym Regulaminem.</p>
            <p style={p}>Platforma stosuje zautomatyzowane narzędzia moderacji treści (AutoMod). Decyzje AutoModa mogą być kwestionowane przez kontakt z operatorem.</p>
            <p style={p}>Zastrzegamy sobie prawo do usunięcia serwerów naruszających Regulamin, po uprzednim powiadomieniu właściciela z wyprzedzeniem min. 48 godzin, chyba że natychmiastowe usunięcie jest konieczne ze względów bezpieczeństwa lub prawnych.</p>
          </section>

          <section>
            <h2 style={h2}>8. Dostępność usługi i ograniczenie odpowiedzialności</h2>
            <p style={p}>Platforma jest udostępniana „tak jak jest" i „w miarę dostępności". Dołożymy starań, aby zapewnić ciągłość działania, jednak nie gwarantujemy jej, szczególnie w fazie testów beta.</p>
            <p style={p}>
              Operator nie ponosi odpowiedzialności za przerwy w działaniu Platformy spowodowane siłą wyższą, awarią infrastruktury zewnętrznej lub działaniami osób trzecich.{' '}
              <strong>Ograniczenie odpowiedzialności nie dotyczy szkód wyrządzonych umyślnie ani roszczeń wynikających z bezwzględnie obowiązujących przepisów prawa ochrony konsumentów.</strong>
            </p>
          </section>

          <section>
            <h2 style={h2}>9. Reklamacje</h2>
            <p style={p}>Wszelkie reklamacje dotyczące działania Platformy lub decyzji moderacyjnych należy kierować na adres <a href="mailto:kontakt@project-z.cloud" style={link}>kontakt@project-z.cloud</a>.</p>
            <p style={p}>Reklamacja powinna zawierać: opis problemu, datę zdarzenia oraz dane kontaktowe. Reklamacje rozpatrujemy w terminie <strong>14 dni roboczych</strong> od otrzymania. O sposobie rozpatrzenia poinformujemy e-mailem.</p>
          </section>

          <section>
            <h2 style={h2}>10. Zmiany Regulaminu</h2>
            <p style={p}>
              O zmianach Regulaminu poinformujemy z wyprzedzeniem <strong>co najmniej 14 dni</strong> (e-mail lub komunikat w aplikacji).
              Jeśli nie akceptujesz zmian, masz prawo usunąć konto przed datą ich wejścia w życie.
              Dalsze korzystanie z Platformy po tej dacie oznacza akceptację nowej wersji Regulaminu.
            </p>
          </section>

          <section>
            <h2 style={h2}>11. Zakończenie konta</h2>
            <p style={p}>Możesz usunąć swoje konto w dowolnym momencie, kontaktując się z nami pod adresem <a href="mailto:kontakt@project-z.cloud" style={link}>kontakt@project-z.cloud</a>. Konto zostanie usunięte w ciągu 14 dni.</p>
            <p style={p}>Zastrzegamy sobie prawo do zawieszenia lub usunięcia konta naruszającego Regulamin. O zawieszeniu poinformujemy e-mailem przed jego dokonaniem (chyba że wymagane jest natychmiastowe działanie ze względów bezpieczeństwa).</p>
          </section>

          <section>
            <h2 style={h2}>12. Pozasądowe rozstrzyganie sporów</h2>
            <p style={p}>
              Konsumenci mają prawo skorzystania z pozasądowych metod rozstrzygania sporów.
              Informacje o dostępnych metodach ADR (Alternative Dispute Resolution) dostępne są na stronach
              Urzędu Ochrony Konkurencji i Konsumentów: <a href="https://uokik.gov.pl" target="_blank" rel="noreferrer" style={link}>uokik.gov.pl</a>.
            </p>
            <p style={p}>
              Spory z konsumentami mogą być rozstrzygane przez platformę ODR Komisji Europejskiej:{' '}
              <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noreferrer" style={link}>ec.europa.eu/consumers/odr</a>.
            </p>
            <p style={p}>Korzystanie z tych metod jest dobrowolne. Operator zastrzega sobie prawo odmowy uczestnictwa w postępowaniu ADR/ODR.</p>
          </section>

          <section>
            <h2 style={h2}>13. Prawo właściwe</h2>
            <p style={p}>Regulamin podlega prawu polskiemu. W kwestiach nieuregulowanych stosuje się przepisy Kodeksu cywilnego, ustawy o świadczeniu usług drogą elektroniczną oraz RODO. Wszelkie spory — o ile przepisy prawa nie stanowią inaczej — rozpatrywane są przez sąd właściwy dla siedziby operatora.</p>
          </section>

          <section>
            <h2 style={h2}>14. Kontakt</h2>
            <p style={p}>Pytania dotyczące Regulaminu: <a href="mailto:kontakt@project-z.cloud" style={link}>kontakt@project-z.cloud</a></p>
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

const h2: React.CSSProperties = { margin: '0 0 12px', fontSize: 18, fontWeight: 600, color: '#f1f5f9' }
const p:  React.CSSProperties = { margin: '0 0 10px', fontSize: 14, color: '#94a3b8' }
const ul: React.CSSProperties = { margin: '0 0 10px', paddingLeft: 20 }
const li: React.CSSProperties = { fontSize: 14, color: '#94a3b8', marginBottom: 6 }
const link: React.CSSProperties = { color: '#f59e0b', textDecoration: 'none' }
