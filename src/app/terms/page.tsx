'use client'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function TermsContent() {
  const params = useSearchParams()
  const lang = params.get('lang') === 'en' ? 'en' : 'pl'

  const privacyHref = `/privacy?lang=${lang}`
  const backLabel = lang === 'en' ? 'Back' : 'Powrót'
  const backApp   = lang === 'en' ? 'Back to Project-Z' : 'Powrót do Nexusa'
  const privacyLabel = lang === 'en' ? 'Privacy Policy' : 'Polityka prywatności'
  const updated = lang === 'en' ? 'Last updated: May 2026' : 'Ostatnia aktualizacja: maj 2026'

  if (lang === 'en') {
    return (
      <div style={{ minHeight: '100vh', background: '#0f0a0f', color: '#f1f5f9' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '48px 24px 80px' }}>
          <div style={{ marginBottom: 40 }}>
            <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: '#94a3b8', fontSize: 14, textDecoration: 'none', marginBottom: 32 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
              {backLabel}
            </Link>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg,#dc2626,#f59e0b)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 22, color: '#fff', flexShrink: 0 }}>N</div>
              <div>
                <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, letterSpacing: -0.5 }}>Terms of Service</h1>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>Project-Z · {updated}</p>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 32, lineHeight: 1.7 }}>
            <section>
              <h2 style={h2}>1. Operator information</h2>
              <p style={p}>The Project-Z platform is operated by an individual running the project at <strong>project-z.cloud</strong>. Contact: <a href="mailto:kontakt@project-z.cloud" style={link}>kontakt@project-z.cloud</a>.</p>
              <p style={p}>These Terms govern the provision of electronic services within the meaning of applicable law.</p>
            </section>
            <section>
              <h2 style={h2}>2. Definitions</h2>
              <p style={p}><strong>Project-Z / Platform</strong> — an online communication service available at project-z.cloud, enabling the creation of servers, text and voice channels, and real-time messaging.</p>
              <p style={p}><strong>User</strong> — any individual aged 16 or older (or 13–15 with written parental consent) who has registered an account and uses the Platform.</p>
              <p style={p}><strong>Server</strong> — a space created by Users, containing channels and a group of members.</p>
              <p style={p}><strong>Content</strong> — any material published by Users: messages, files, images, reactions.</p>
              <p style={p}><strong>Service</strong> — the electronic communication and content sharing service provided through the Platform.</p>
            </section>
            <section>
              <h2 style={h2}>3. Acceptance of Terms</h2>
              <p style={p}>Registering an account constitutes acceptance of these Terms and the <Link href={privacyHref} style={link}>Privacy Policy</Link>. If you do not accept these terms, do not create an account or use the Platform.</p>
              <p style={p}>The Platform is in beta testing. Data may be reset with at least 7 days' notice (via email or in-app message), unless a reset is required for technical or security reasons.</p>
            </section>
            <section>
              <h2 style={h2}>4. Account and security</h2>
              <ul style={ul}>
                <li style={li}>You must be at least <strong>16 years old</strong> to use Project-Z independently. Users aged 13–15 may use the Platform only with written parental or guardian consent.</li>
                <li style={li}>You are responsible for maintaining the confidentiality of your account password and for all actions taken under it.</li>
                <li style={li}>Each person may hold one active account. Creating multiple accounts to circumvent bans is prohibited.</li>
                <li style={li}>Notify us immediately of any unauthorized access to your account at <a href="mailto:kontakt@project-z.cloud" style={link}>kontakt@project-z.cloud</a>.</li>
                <li style={li}>Your email address must be verifiable and belong to you.</li>
              </ul>
            </section>
            <section>
              <h2 style={h2}>5. Acceptable use</h2>
              <p style={p}>The following are prohibited:</p>
              <ul style={ul}>
                <li style={li}>posting illegal content, pornography (unless the server has proper age verification), or content inciting violence or hatred based on race, ethnicity, gender, religion, or sexual orientation;</li>
                <li style={li}>harassment, stalking, or threatening other users;</li>
                <li style={li}>sending spam, malware, or phishing links;</li>
                <li style={li}>impersonating other individuals or organizations;</li>
                <li style={li}>attempting to gain unauthorized access to servers or other users' accounts;</li>
                <li style={li}>overloading infrastructure (DDoS attacks, flooding);</li>
                <li style={li}>automating your account without our written permission (bots, scraping).</li>
              </ul>
            </section>
            <section>
              <h2 style={h2}>6. User content</h2>
              <p style={p}>You retain all rights to the content you post on the Platform. You grant us a non-exclusive, royalty-free, revocable license to store and display that content <strong>solely for the purpose of providing the Service and for the duration of the Service</strong>. The license expires when the content or account is deleted.</p>
              <p style={p}>You are fully responsible for the content you post. We do not preemptively monitor content but respond to reports of violations within 14 business days.</p>
              <p style={p}>Content violating these Terms may be removed without notice. We will inform you by email within 48 hours. Repeated violations result in account suspension or deletion.</p>
            </section>
            <section>
              <h2 style={h2}>7. Servers and moderation</h2>
              <p style={p}>Server owners share responsibility for content published on their servers. Moderation tools (mute, ban, automod) are used to maintain order in accordance with these Terms.</p>
              <p style={p}>The Platform uses automated content moderation (AutoMod). AutoMod decisions can be contested by contacting the operator.</p>
              <p style={p}>We reserve the right to remove servers that violate the Terms, with at least 48 hours' notice to the owner, unless immediate removal is required for security or legal reasons.</p>
            </section>
            <section>
              <h2 style={h2}>8. Service availability and liability</h2>
              <p style={p}>The Platform is provided "as is" and "as available". We will endeavor to ensure continuity but do not guarantee it, especially during beta testing.</p>
              <p style={p}><strong>Limitation of liability does not apply to intentional damages or claims arising under mandatory consumer protection law.</strong></p>
            </section>
            <section>
              <h2 style={h2}>9. Complaints</h2>
              <p style={p}>All complaints regarding Platform operation or moderation decisions should be directed to <a href="mailto:kontakt@project-z.cloud" style={link}>kontakt@project-z.cloud</a>.</p>
              <p style={p}>A complaint should include: description of the issue, date of the event, and contact details. We handle complaints within <strong>14 business days</strong>.</p>
            </section>
            <section>
              <h2 style={h2}>10. Changes to Terms</h2>
              <p style={p}>We will notify you of changes to the Terms at least <strong>14 days</strong> in advance (via email or in-app message). If you do not accept the changes, you may delete your account before they take effect. Continued use of the Platform after that date constitutes acceptance of the new Terms.</p>
            </section>
            <section>
              <h2 style={h2}>11. Account termination</h2>
              <p style={p}>You may delete your account at any time by contacting us at <a href="mailto:kontakt@project-z.cloud" style={link}>kontakt@project-z.cloud</a>. The account will be deleted within 14 days.</p>
              <p style={p}>We reserve the right to suspend or delete accounts that violate the Terms. We will notify you by email before suspension (unless immediate action is required for security reasons).</p>
            </section>
            <section>
              <h2 style={h2}>12. Dispute resolution</h2>
              <p style={p}>Consumers may use alternative dispute resolution (ADR) methods. Information about available ADR methods is available at the relevant consumer protection authority in your country.</p>
              <p style={p}>The EU Online Dispute Resolution platform: <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noreferrer" style={link}>ec.europa.eu/consumers/odr</a>.</p>
            </section>
            <section>
              <h2 style={h2}>13. Governing law</h2>
              <p style={p}>These Terms are governed by Polish law. Matters not regulated herein are governed by the Civil Code and applicable electronic services law.</p>
            </section>
            <section>
              <h2 style={h2}>14. Contact</h2>
              <p style={p}>Questions about the Terms: <a href="mailto:kontakt@project-z.cloud" style={link}>kontakt@project-z.cloud</a></p>
            </section>
          </div>

          <div style={{ marginTop: 48, paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <Link href={privacyHref} style={link}>{privacyLabel}</Link>
            <Link href="/" style={{ ...link, color: '#64748b' }}>{backApp}</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0f0a0f', color: '#f1f5f9' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '48px 24px 80px' }}>
        <div style={{ marginBottom: 40 }}>
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: '#94a3b8', fontSize: 14, textDecoration: 'none', marginBottom: 32 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
            {backLabel}
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg,#dc2626,#f59e0b)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 22, color: '#fff', flexShrink: 0 }}>N</div>
            <div>
              <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, letterSpacing: -0.5 }}>Regulamin</h1>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>Project-Z · {updated}</p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 32, lineHeight: 1.7 }}>
          <section>
            <h2 style={h2}>1. Dane operatora</h2>
            <p style={p}>Operatorem Platformy jest osoba fizyczna prowadząca projekt pod nazwą <strong>Project-Z / project-z.cloud</strong>. Kontakt: <a href="mailto:kontakt@project-z.cloud" style={link}>kontakt@project-z.cloud</a>.</p>
            <p style={p}>Niniejszy Regulamin reguluje zasady świadczenia usług drogą elektroniczną w rozumieniu ustawy z dnia 18 lipca 2002 r. o świadczeniu usług drogą elektroniczną (Dz.U. 2002 nr 144 poz. 1204 z późn. zm.).</p>
          </section>
          <section>
            <h2 style={h2}>2. Definicje</h2>
            <p style={p}><strong>Project-Z / Platforma</strong> — usługa komunikacji online dostępna pod adresem project-z.cloud, umożliwiająca tworzenie serwerów, kanałów tekstowych i głosowych oraz wymianę wiadomości w czasie rzeczywistym.</p>
            <p style={p}><strong>Użytkownik</strong> — każda osoba fizyczna, która ukończyła 16 lat (lub 13 lat za pisemną zgodą rodzica/opiekuna prawnego), zarejestrowała konto i korzysta z Platformy.</p>
            <p style={p}><strong>Serwer</strong> — przestrzeń tworzona przez Użytkowników, zawierająca kanały i grono członków.</p>
            <p style={p}><strong>Treści</strong> — wszelkie materiały publikowane przez Użytkowników: wiadomości, pliki, obrazy, reakcje.</p>
            <p style={p}><strong>Usługa</strong> — świadczona drogą elektroniczną usługa komunikacji i wymiany treści w ramach Platformy.</p>
          </section>
          <section>
            <h2 style={h2}>3. Akceptacja Regulaminu</h2>
            <p style={p}>Rejestracja konta jest równoznaczna z akceptacją niniejszego Regulaminu oraz <Link href={privacyHref} style={link}>Polityki prywatności</Link>. Jeśli nie akceptujesz tych warunków, nie zakładaj konta ani nie korzystaj z Platformy.</p>
            <p style={p}>Platforma jest w fazie testów beta. Dane mogą zostać zresetowane po uprzednim powiadomieniu użytkowników (e-mail lub komunikat w aplikacji) z wyprzedzeniem min. 7 dni, chyba że reset jest konieczny z przyczyn technicznych lub bezpieczeństwa.</p>
          </section>
          <section>
            <h2 style={h2}>4. Konto i bezpieczeństwo</h2>
            <ul style={ul}>
              <li style={li}>Musisz mieć ukończone <strong>16 lat</strong>, aby samodzielnie korzystać z Project-Z. Osoby w wieku 13–15 lat mogą korzystać z Platformy wyłącznie za pisemną zgodą rodzica lub opiekuna prawnego.</li>
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
            <p style={p}><strong>Ograniczenie odpowiedzialności nie dotyczy szkód wyrządzonych umyślnie ani roszczeń wynikających z bezwzględnie obowiązujących przepisów prawa ochrony konsumentów.</strong></p>
          </section>
          <section>
            <h2 style={h2}>9. Reklamacje</h2>
            <p style={p}>Wszelkie reklamacje dotyczące działania Platformy lub decyzji moderacyjnych należy kierować na adres <a href="mailto:kontakt@project-z.cloud" style={link}>kontakt@project-z.cloud</a>.</p>
            <p style={p}>Reklamacja powinna zawierać: opis problemu, datę zdarzenia oraz dane kontaktowe. Reklamacje rozpatrujemy w terminie <strong>14 dni roboczych</strong> od otrzymania. O sposobie rozpatrzenia poinformujemy e-mailem.</p>
          </section>
          <section>
            <h2 style={h2}>10. Zmiany Regulaminu</h2>
            <p style={p}>O zmianach Regulaminu poinformujemy z wyprzedzeniem <strong>co najmniej 14 dni</strong> (e-mail lub komunikat w aplikacji). Jeśli nie akceptujesz zmian, masz prawo usunąć konto przed datą ich wejścia w życie. Dalsze korzystanie z Platformy po tej dacie oznacza akceptację nowej wersji Regulaminu.</p>
          </section>
          <section>
            <h2 style={h2}>11. Zakończenie konta</h2>
            <p style={p}>Możesz usunąć swoje konto w dowolnym momencie w ustawieniach aplikacji lub kontaktując się z nami pod adresem <a href="mailto:kontakt@project-z.cloud" style={link}>kontakt@project-z.cloud</a>. Konto zostanie usunięte w ciągu 14 dni.</p>
            <p style={p}>Zastrzegamy sobie prawo do zawieszenia lub usunięcia konta naruszającego Regulamin. O zawieszeniu poinformujemy e-mailem przed jego dokonaniem (chyba że wymagane jest natychmiastowe działanie ze względów bezpieczeństwa).</p>
          </section>
          <section>
            <h2 style={h2}>12. Pozasądowe rozstrzyganie sporów</h2>
            <p style={p}>Konsumenci mają prawo skorzystania z pozasądowych metod rozstrzygania sporów. Informacje dostępne są na stronach UOKiK: <a href="https://uokik.gov.pl" target="_blank" rel="noreferrer" style={link}>uokik.gov.pl</a>.</p>
            <p style={p}>Platforma ODR Komisji Europejskiej: <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noreferrer" style={link}>ec.europa.eu/consumers/odr</a>.</p>
          </section>
          <section>
            <h2 style={h2}>13. Prawo właściwe</h2>
            <p style={p}>Regulamin podlega prawu polskiemu. W kwestiach nieuregulowanych stosuje się przepisy Kodeksu cywilnego oraz ustawy o świadczeniu usług drogą elektroniczną.</p>
          </section>
          <section>
            <h2 style={h2}>14. Kontakt</h2>
            <p style={p}>Pytania dotyczące Regulaminu: <a href="mailto:kontakt@project-z.cloud" style={link}>kontakt@project-z.cloud</a></p>
          </section>
        </div>

        <div style={{ marginTop: 48, paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <Link href={privacyHref} style={link}>{privacyLabel}</Link>
          <Link href="/" style={{ ...link, color: '#64748b' }}>{backApp}</Link>
        </div>
      </div>
    </div>
  )
}

export default function TermsPage() {
  return <Suspense><TermsContent /></Suspense>
}

const h2: React.CSSProperties = { margin: '0 0 12px', fontSize: 18, fontWeight: 600, color: '#f1f5f9' }
const p:  React.CSSProperties = { margin: '0 0 10px', fontSize: 14, color: '#94a3b8' }
const ul: React.CSSProperties = { margin: '0 0 10px', paddingLeft: 20 }
const li: React.CSSProperties = { fontSize: 14, color: '#94a3b8', marginBottom: 6 }
const link: React.CSSProperties = { color: '#f59e0b', textDecoration: 'none' }
