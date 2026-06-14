'use client'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function PrivacyContent() {
  const params = useSearchParams()
  const lang = params.get('lang') === 'en' ? 'en' : 'pl'

  const termsHref = `/terms?lang=${lang}`
  const backLabel = lang === 'en' ? 'Back' : 'Powrót'
  const backApp   = lang === 'en' ? 'Back to Project-Z' : 'Powrót do Project-Z'
  const termsLabel = lang === 'en' ? 'Terms of Service' : 'Regulamin'
  const updated = lang === 'en' ? 'Last updated: June 2026' : 'Ostatnia aktualizacja: czerwiec 2026'

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
                <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, letterSpacing: -0.5 }}>Privacy Policy</h1>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>Project-Z · {updated}</p>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 32, lineHeight: 1.7 }}>
            <section>
              <h2 style={h2}>1. Data controller</h2>
              <p style={p}>The data controller is the operator of the Project-Z platform at <strong>project-z.cloud</strong>.</p>
              <p style={p}>Contact for data protection matters: <a href="mailto:kontakt@project-z.cloud" style={link}>kontakt@project-z.cloud</a></p>
              <p style={p}><strong>Data Protection Officer (DPO):</strong> The operator has not appointed a DPO as it is not required under Article 37 GDPR (the scale of processing does not meet the obligation criteria). Direct all data-related questions to the operator.</p>
            </section>
            <section>
              <h2 style={h2}>2. What data we collect and why</h2>
              <p style={p}>We collect only data necessary to provide the Service:</p>
              <ul style={ul}>
                <li style={li}><strong style={{ color: '#f1f5f9' }}>Registration data</strong> — email address, username, password (stored only as a bcrypt hash, never in plaintext), display name, avatar color. <br/><span style={{ fontSize: 12, color: '#64748b' }}>Legal basis: Art. 6(1)(b) GDPR (performance of a contract).</span></li>
                <li style={li}><strong style={{ color: '#f1f5f9' }}>Profile data</strong> — custom status, avatar image (optional, uploaded voluntarily), interface preferences. <br/><span style={{ fontSize: 12, color: '#64748b' }}>Legal basis: Art. 6(1)(b) GDPR.</span></li>
                <li style={li}><strong style={{ color: '#f1f5f9' }}>Two-factor authentication (2FA) data</strong> — if you enable 2FA, the TOTP secret key is stored in the database in encrypted form (AES-256-GCM), with access restricted to the application server. The secret is used solely for login verification and is never shared with third parties. <br/><span style={{ fontSize: 12, color: '#64748b' }}>Legal basis: Art. 6(1)(b) GDPR.</span></li>
                <li style={li}><strong style={{ color: '#f1f5f9' }}>E2E encryption keys</strong> — if you enable end-to-end encryption for private messages (DMs), we store your public key and a client-side-encrypted private key (the operator cannot access it). The content of encrypted DMs is unreadable to us. <br/><span style={{ fontSize: 12, color: '#64748b' }}>Legal basis: Art. 6(1)(b) GDPR.</span></li>
                <li style={li}><strong style={{ color: '#f1f5f9' }}>User content</strong> — messages, files, reactions sent on the Platform. <br/><span style={{ fontSize: 12, color: '#64748b' }}>Legal basis: Art. 6(1)(b) GDPR.</span></li>
                <li style={li}><strong style={{ color: '#f1f5f9' }}>IP address and technical data</strong> — IP address at login and registration, server error logs. Used to detect abuse, attacks, and unauthorized access. <br/><span style={{ fontSize: 12, color: '#64748b' }}>Legal basis: Art. 6(1)(f) GDPR (legitimate interests — system security). Retention: 12 months.</span></li>
                <li style={li}><strong style={{ color: '#f1f5f9' }}>Activity data</strong> — last login time, online/offline status, voice session history (duration only, no recordings). <br/><span style={{ fontSize: 12, color: '#64748b' }}>Legal basis: Art. 6(1)(b) GDPR.</span></li>
              </ul>
            </section>
            <section>
              <h2 style={h2}>3. Automated processing and profiling</h2>
              <p style={p}>The Platform uses an <strong>automated content moderation tool (AutoMod)</strong> that analyzes messages for violations of server rules and may automatically block or mute a user's account. This constitutes automated decision-making within the meaning of Art. 22 GDPR.</p>
              <p style={p}>You have the right to obtain human intervention — contact the operator or the server owner where AutoMod made a decision.</p>
              <p style={p}>The Platform <strong>does not profile</strong> users for advertising purposes or make other automated decisions with significant impact on your rights.</p>
            </section>
            <section>
              <h2 style={h2}>4. Data retention</h2>
              <ul style={ul}>
                <li style={li}><strong style={{ color: '#f1f5f9' }}>Account data</strong> — for the duration of the account. After deletion, data is removed within 30 days, except as required by law or for dispute resolution.</li>
                <li style={li}><strong style={{ color: '#f1f5f9' }}>Messages</strong> — until deleted by you or the server owner. Deleting your account does not automatically delete messages sent on third-party servers.</li>
                <li style={li}><strong style={{ color: '#f1f5f9' }}>IP addresses and security logs</strong> — maximum 12 months.</li>
                <li style={li}><strong style={{ color: '#f1f5f9' }}>Email verification tokens</strong> — 24 hours, then automatically deleted.</li>
                <li style={li}><strong style={{ color: '#f1f5f9' }}>Moderation logs</strong> — 90 days, unless needed for ongoing proceedings.</li>
                <li style={li}><strong style={{ color: '#f1f5f9' }}>Login lockout records</strong> — automatically removed upon successful login. Maximum 24 hours.</li>
              </ul>
              <p style={{ ...p, color: '#64748b', fontSize: 13 }}>The Platform is in beta. Data may be reset for technical reasons with prior notice.</p>
            </section>
            <section>
              <h2 style={h2}>5. Recipients — transfers to third parties</h2>
              <p style={p}>We do not sell your personal data. Data may be shared only with:</p>
              <ul style={ul}>
                <li style={li}><strong style={{ color: '#f1f5f9' }}>OVH SAS</strong> (France, EEA) — VPS server provider. Data processed within the EU.</li>
                <li style={li}><strong style={{ color: '#f1f5f9' }}>Vercel Inc.</strong> (USA, outside EEA) — frontend hosting. Transfer is based on Standard Contractual Clauses (SCCs) approved by the European Commission (Art. 46(2)(c) GDPR). Vercel privacy policy: <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noreferrer" style={link}>vercel.com/legal/privacy-policy</a>.</li>
                <li style={li}><strong style={{ color: '#f1f5f9' }}>Resend, Inc.</strong> (USA, outside EEA) — email service provider used solely for transactional messages (account verification, password reset, system notifications). No user message content is shared. Transfer is based on Standard Contractual Clauses (SCCs). Delivery itself is carried out via Amazon SES in an EU region.</li>
                <li style={li}><strong style={{ color: '#f1f5f9' }}>Public authorities and law enforcement</strong> — when required by applicable law or when there are reasonable grounds to suspect the commission of a criminal offence. Such disclosure may occur without prior notice to the user.</li>
              </ul>
              <p style={p}>No data is transferred to third countries beyond the scope described above.</p>
            </section>
            <section>
              <h2 style={h2}>6. Session cookie and local storage</h2>
              <p style={p}>After logging in, the Platform sets a session cookie named <strong>pz_token</strong> in your browser. This cookie is:</p>
              <ul style={ul}>
                <li style={li}><strong style={{ color: '#f1f5f9' }}>HttpOnly</strong> — not accessible to JavaScript, which protects against XSS token theft;</li>
                <li style={li}><strong style={{ color: '#f1f5f9' }}>Secure</strong> — sent only over HTTPS connections;</li>
                <li style={li}><strong style={{ color: '#f1f5f9' }}>SameSite=Lax</strong> — limits cross-site sending, protecting against CSRF attacks;</li>
                <li style={li}>valid for the duration of the session and deleted upon logout.</li>
              </ul>
              <p style={p}>The <strong>Project-Z desktop application</strong> stores the session token in <strong>sessionStorage</strong> — deleted when the application window is closed.</p>
              <p style={p}>We do not use analytics trackers (e.g. Google Analytics), advertising pixels, or browser fingerprinting tools. We do not set any tracking or advertising cookies.</p>
            </section>
            <section>
              <h2 style={h2}>7. Desktop application — additional data</h2>
              <p style={p}>The Project-Z desktop application may collect additional data locally on your device:</p>
              <ul style={ul}>
                <li style={li}><strong style={{ color: '#f1f5f9' }}>PTT key assignment</strong> — the key you assign for PTT is stored locally on your device and is not sent to our servers.</li>
                <li style={li}><strong style={{ color: '#f1f5f9' }}>Global keyboard/mouse hooks</strong> — the application uses the uiohook library to detect the assigned PTT key being pressed globally (outside the app window). The library does not log or transmit keystrokes — it only checks whether the specific assigned key was pressed at the moment of detection.</li>
                <li style={li}><strong style={{ color: '#f1f5f9' }}>E2E encryption recovery code</strong> — if you save your recovery code on the device, it is stored locally, encrypted by the operating system mechanism (Windows DPAPI / Electron safeStorage), and is never sent to our servers.</li>
              </ul>
            </section>
            <section>
              <h2 style={h2}>8. Your rights (GDPR)</h2>
              <p style={p}>Under GDPR you have the following rights. To exercise them, write to <a href="mailto:kontakt@project-z.cloud" style={link}>kontakt@project-z.cloud</a>. We will respond within 30 days:</p>
              <ul style={ul}>
                <li style={li}><strong style={{ color: '#f1f5f9' }}>Access (Art. 15)</strong> — right to obtain a copy of processed data and information about processing.</li>
                <li style={li}><strong style={{ color: '#f1f5f9' }}>Rectification (Art. 16)</strong> — right to correct inaccurate or complete incomplete data.</li>
                <li style={li}><strong style={{ color: '#f1f5f9' }}>Erasure (Art. 17)</strong> — right to request deletion ("right to be forgotten") when data is no longer necessary or you withdraw consent.</li>
                <li style={li}><strong style={{ color: '#f1f5f9' }}>Restriction (Art. 18)</strong> — right to request suspension of processing in specific situations.</li>
                <li style={li}><strong style={{ color: '#f1f5f9' }}>Portability (Art. 20)</strong> — right to receive data in a structured, commonly used format (JSON).</li>
                <li style={li}><strong style={{ color: '#f1f5f9' }}>Objection (Art. 21)</strong> — right to object to processing based on legitimate interests (Art. 6(1)(f)).</li>
                <li style={li}><strong style={{ color: '#f1f5f9' }}>Human intervention (Art. 22)</strong> — right to challenge a decision made solely by automated means (e.g. by AutoMod).</li>
              </ul>
            </section>
            <section>
              <h2 style={h2}>9. Data security</h2>
              <p style={p}>We apply the following security measures:</p>
              <ul style={ul}>
                <li style={li}>Passwords stored only as bcrypt hashes (cost 12) — never in plaintext.</li>
                <li style={li}>All communication encrypted with TLS 1.2+/HTTPS.</li>
                <li style={li}>Session token stored in an HttpOnly cookie — inaccessible to JavaScript.</li>
                <li style={li}>JWT tokens signed with HMAC-SHA256 with limited validity.</li>
                <li style={li}>Database access restricted to application server IP addresses.</li>
                <li style={li}>Account lockout after 5 failed login attempts (15 minutes) — stored in the database, persists through server restarts.</li>
                <li style={li}>Suspicious activity monitoring: IP ban, rate limiting, flood detection.</li>
                <li style={li}>Single-use email verification tokens, valid for 24 hours.</li>
                <li style={li}>Security headers: HSTS, X-Frame-Options, X-Content-Type-Options, CORP, COOP.</li>
              </ul>
            </section>
            <section>
              <h2 style={h2}>10. Minors</h2>
              <p style={p}>The Platform is not intended for individuals under 13 years of age. Users aged 13–15 may use the Platform only with parental or guardian consent, in accordance with Art. 8 GDPR.</p>
              <p style={p}>If you believe a child under 13 has an account, contact us at <a href="mailto:kontakt@project-z.cloud" style={link}>kontakt@project-z.cloud</a> — we will remove the account immediately.</p>
            </section>
            <section>
              <h2 style={h2}>11. Changes to this Policy</h2>
              <p style={p}>We will notify you of material changes to this Policy via email or in-app message at least <strong>14 days</strong> before they take effect. The date of last update is shown at the top of the page.</p>
            </section>
            <section>
              <h2 style={h2}>12. Right to lodge a complaint</h2>
              <p style={p}>If you believe we are processing your data unlawfully, you have the right to lodge a complaint with your national data protection authority. In Poland, this is the President of the Personal Data Protection Office (UODO):</p>
              <ul style={ul}>
                <li style={li}>Address: ul. Stawki 2, 00-193 Warsaw, Poland</li>
                <li style={li}>Website: <a href="https://uodo.gov.pl" target="_blank" rel="noreferrer" style={link}>uodo.gov.pl</a></li>
                <li style={li}>Email: <a href="mailto:kancelaria@uodo.gov.pl" style={link}>kancelaria@uodo.gov.pl</a></li>
              </ul>
              <p style={p}>We encourage you to contact us first — we will try to resolve the issue directly.</p>
            </section>
          </div>

          <div style={{ marginTop: 48, paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <Link href={termsHref} style={link}>{termsLabel}</Link>
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
              <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, letterSpacing: -0.5 }}>Polityka prywatności</h1>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>Project-Z · {updated}</p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 32, lineHeight: 1.7 }}>
          <section>
            <h2 style={h2}>1. Administrator danych osobowych</h2>
            <p style={p}>Administratorem Twoich danych osobowych jest operator platformy Project-Z prowadzący projekt pod adresem <strong>project-z.cloud</strong>.</p>
            <p style={p}>Kontakt z Administratorem w sprawach ochrony danych osobowych: <a href="mailto:kontakt@project-z.cloud" style={link}>kontakt@project-z.cloud</a></p>
            <p style={p}><strong>Inspektor Ochrony Danych (IOD):</strong> Administrator nie wyznaczył Inspektora Ochrony Danych, gdyż nie jest do tego zobowiązany na podstawie art. 37 RODO. Wszelkie pytania dotyczące ochrony danych kieruj bezpośrednio do Administratora.</p>
          </section>
          <section>
            <h2 style={h2}>2. Jakie dane zbieramy i w jakim celu</h2>
            <p style={p}>Zbieramy wyłącznie dane niezbędne do świadczenia Usługi:</p>
            <ul style={ul}>
              <li style={li}><strong style={{ color: '#f1f5f9' }}>Dane rejestracyjne</strong> — adres e-mail, nazwa użytkownika, hasło (przechowywane wyłącznie jako skrót bcrypt, nigdy w postaci jawnej), wyświetlana nazwa, kolor avatara.<br/><span style={{ fontSize: 12, color: '#64748b' }}>Podstawa: art. 6 ust. 1 lit. b RODO (wykonanie umowy).</span></li>
              <li style={li}><strong style={{ color: '#f1f5f9' }}>Dane profilu</strong> — własny status, zdjęcie avatara (opcjonalnie, przesyłane dobrowolnie), preferencje interfejsu.<br/><span style={{ fontSize: 12, color: '#64748b' }}>Podstawa: art. 6 ust. 1 lit. b RODO.</span></li>
              <li style={li}><strong style={{ color: '#f1f5f9' }}>Dane weryfikacji dwuetapowej (2FA)</strong> — jeśli włączysz 2FA, klucz tajny TOTP jest przechowywany w bazie danych w postaci zaszyfrowanej (AES-256-GCM), z dostępem ograniczonym do serwera aplikacji. Klucz służy wyłącznie do weryfikacji logowania i nie jest udostępniany podmiotom trzecim.<br/><span style={{ fontSize: 12, color: '#64748b' }}>Podstawa: art. 6 ust. 1 lit. b RODO.</span></li>
              <li style={li}><strong style={{ color: '#f1f5f9' }}>Klucze szyfrowania E2E</strong> — jeśli włączysz szyfrowanie end-to-end wiadomości prywatnych (DM), na serwerze przechowujemy Twój klucz publiczny oraz klucz prywatny zaszyfrowany po stronie klienta (operator nie ma do niego dostępu). Treść zaszyfrowanych DM jest dla nas nieczytelna.<br/><span style={{ fontSize: 12, color: '#64748b' }}>Podstawa: art. 6 ust. 1 lit. b RODO.</span></li>
              <li style={li}><strong style={{ color: '#f1f5f9' }}>Treści użytkownika</strong> — wiadomości, pliki, reakcje wysyłane na Platformie.<br/><span style={{ fontSize: 12, color: '#64748b' }}>Podstawa: art. 6 ust. 1 lit. b RODO.</span></li>
              <li style={li}><strong style={{ color: '#f1f5f9' }}>Adres IP i dane techniczne</strong> — adres IP przy logowaniu i rejestracji, logi błędów serwera. Dane służą do wykrywania nadużyć i nieautoryzowanego dostępu.<br/><span style={{ fontSize: 12, color: '#64748b' }}>Podstawa: art. 6 ust. 1 lit. f RODO (uzasadniony interes — bezpieczeństwo). Retencja: 12 miesięcy.</span></li>
              <li style={li}><strong style={{ color: '#f1f5f9' }}>Dane aktywności</strong> — czas ostatniego logowania, status online/offline, historia połączeń głosowych (tylko czas trwania, bez nagrań).<br/><span style={{ fontSize: 12, color: '#64748b' }}>Podstawa: art. 6 ust. 1 lit. b RODO.</span></li>
            </ul>
          </section>
          <section>
            <h2 style={h2}>3. Zautomatyzowane przetwarzanie i profilowanie</h2>
            <p style={p}>Platforma stosuje <strong>zautomatyzowane narzędzie moderacji treści (AutoMod)</strong>, które analizuje wiadomości pod kątem naruszenia zasad serwera i może automatycznie je blokować lub wyciszać konto użytkownika. Stanowi to zautomatyzowane podejmowanie decyzji w rozumieniu art. 22 RODO.</p>
            <p style={p}>Masz prawo do uzyskania interwencji człowieka w tej sprawie — skontaktuj się z Administratorem lub właścicielem serwera, na którym AutoMod podjął decyzję.</p>
            <p style={p}>Platforma <strong>nie profiluje</strong> użytkowników w celach reklamowych ani nie podejmuje innych zautomatyzowanych decyzji mających istotny wpływ na Twoje prawa.</p>
          </section>
          <section>
            <h2 style={h2}>4. Okres przechowywania danych</h2>
            <ul style={ul}>
              <li style={li}><strong style={{ color: '#f1f5f9' }}>Dane konta</strong> — przez czas istnienia konta. Po usunięciu konta dane są kasowane w ciągu 30 dni, z wyjątkiem danych wymaganych przepisami prawa lub niezbędnych do rozwiązania sporów.</li>
              <li style={li}><strong style={{ color: '#f1f5f9' }}>Wiadomości</strong> — do czasu usunięcia przez Ciebie lub właściciela serwera. Usunięcie konta nie kasuje automatycznie wiadomości wysłanych na serwerach osób trzecich.</li>
              <li style={li}><strong style={{ color: '#f1f5f9' }}>Adresy IP i logi bezpieczeństwa</strong> — maksymalnie 12 miesięcy.</li>
              <li style={li}><strong style={{ color: '#f1f5f9' }}>Tokeny weryfikacji e-mail</strong> — 24 godziny, następnie automatycznie usuwane.</li>
              <li style={li}><strong style={{ color: '#f1f5f9' }}>Logi moderacyjne</strong> — 90 dni, chyba że są potrzebne w związku z toczącym się postępowaniem.</li>
              <li style={li}><strong style={{ color: '#f1f5f9' }}>Rekordy blokady logowania</strong> — usuwane automatycznie po pomyślnym zalogowaniu. Maksymalnie 24 godziny.</li>
            </ul>
            <p style={{ ...p, color: '#64748b', fontSize: 13 }}>Platforma jest w fazie testów beta. Dane mogą zostać zresetowane z powodów technicznych po uprzednim powiadomieniu.</p>
          </section>
          <section>
            <h2 style={h2}>5. Odbiorcy danych — transfer do podmiotów trzecich</h2>
            <p style={p}>Nie sprzedajemy Twoich danych osobowych. Dane mogą być przekazywane wyłącznie:</p>
            <ul style={ul}>
              <li style={li}><strong style={{ color: '#f1f5f9' }}>OVH SAS</strong> (Francja, EOG) — dostawca serwera VPS. Dane przetwarzane w UE.</li>
              <li style={li}><strong style={{ color: '#f1f5f9' }}>Vercel Inc.</strong> (USA, poza EOG) — hosting frontendowy. Transfer na podstawie standardowych klauzul umownych (SCC) zatwierdzonych przez KE (art. 46 ust. 2 lit. c RODO). Polityka prywatności Vercel: <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noreferrer" style={link}>vercel.com/legal/privacy-policy</a>.</li>
              <li style={li}><strong style={{ color: '#f1f5f9' }}>Resend, Inc.</strong> (USA, poza EOG) — dostawca usługi e-mail, wykorzystywany wyłącznie do wiadomości transakcyjnych (weryfikacja konta, reset hasła, powiadomienia systemowe). Żadne treści wiadomości użytkowników nie są przekazywane. Transfer na podstawie standardowych klauzul umownych (SCC). Samo dostarczanie realizowane jest przez Amazon SES w regionie UE.</li>
              <li style={li}><strong style={{ color: '#f1f5f9' }}>Organy publiczne i organy ścigania</strong> — gdy jest to wymagane przez obowiązujące przepisy prawa lub gdy istnieją uzasadnione podstawy do podejrzenia popełnienia przestępstwa. Przekazanie może nastąpić bez uprzedniego powiadomienia użytkownika.</li>
            </ul>
            <p style={p}>Żadne dane nie są przekazywane do krajów trzecich poza zakresem opisanym powyżej.</p>
          </section>
          <section>
            <h2 style={h2}>6. Cookie sesyjne i dane lokalne</h2>
            <p style={p}>Po zalogowaniu Platforma ustawia w Twojej przeglądarce cookie sesyjne o nazwie <strong>pz_token</strong>. Cookie to jest:</p>
            <ul style={ul}>
              <li style={li}><strong style={{ color: '#f1f5f9' }}>HttpOnly</strong> — niedostępne dla JavaScript, co chroni przed kradzieżą tokena przez ataki XSS;</li>
              <li style={li}><strong style={{ color: '#f1f5f9' }}>Secure</strong> — przesyłane wyłącznie przez połączenia HTTPS;</li>
              <li style={li}><strong style={{ color: '#f1f5f9' }}>SameSite=Lax</strong> — ogranicza wysyłanie w kontekście cross-site, chroniąc przed atakami CSRF;</li>
              <li style={li}>ważne przez czas sesji, usuwane przy wylogowaniu.</li>
            </ul>
            <p style={p}><strong>Aplikacja desktopowa Project-Z</strong> przechowuje token sesji w <strong>sessionStorage</strong> — jest usuwany po zamknięciu okna aplikacji.</p>
            <p style={p}>Nie stosujemy trackerów analitycznych (np. Google Analytics), pikseli reklamowych ani narzędzi do fingerprintingu przeglądarki. Nie ustawiamy żadnych cookies śledzących ani reklamowych.</p>
          </section>
          <section>
            <h2 style={h2}>7. Aplikacja desktopowa — dodatkowe dane</h2>
            <p style={p}>Aplikacja desktopowa Project-Z może zbierać dodatkowe dane lokalnie na Twoim urządzeniu:</p>
            <ul style={ul}>
              <li style={li}><strong style={{ color: '#f1f5f9' }}>Przypisanie klawisza PTT</strong> — klawisz przypisany do PTT jest przechowywany lokalnie na Twoim urządzeniu i nie jest wysyłany na nasze serwery.</li>
              <li style={li}><strong style={{ color: '#f1f5f9' }}>Globalne hooki klawiatury i myszy</strong> — aplikacja używa biblioteki uiohook do wykrywania wciśnięcia przypisanego klawisza PTT globalnie (poza oknem aplikacji). Biblioteka nie rejestruje ani nie przesyła naciśnięć klawiszy — sprawdza wyłącznie, czy w chwili wykrycia został wciśnięty konkretny, przypisany klawisz.</li>
              <li style={li}><strong style={{ color: '#f1f5f9' }}>Kod odzyskiwania szyfrowania E2E</strong> — jeśli zapiszesz kod odzyskiwania na urządzeniu, jest on przechowywany lokalnie w postaci zaszyfrowanej przez mechanizm systemu operacyjnego (Windows DPAPI / Electron safeStorage) i nie jest przesyłany na nasze serwery.</li>
            </ul>
          </section>
          <section>
            <h2 style={h2}>8. Twoje prawa (RODO)</h2>
            <p style={p}>Zgodnie z RODO przysługują Ci następujące prawa. Aby z nich skorzystać, napisz na <a href="mailto:kontakt@project-z.cloud" style={link}>kontakt@project-z.cloud</a>. Odpowiemy w ciągu 30 dni:</p>
            <ul style={ul}>
              <li style={li}><strong style={{ color: '#f1f5f9' }}>Dostęp (art. 15)</strong> — prawo do uzyskania kopii przetwarzanych danych i informacji o przetwarzaniu.</li>
              <li style={li}><strong style={{ color: '#f1f5f9' }}>Sprostowanie (art. 16)</strong> — prawo do poprawienia nieprawidłowych lub uzupełnienia niekompletnych danych.</li>
              <li style={li}><strong style={{ color: '#f1f5f9' }}>Usunięcie (art. 17)</strong> — prawo do żądania usunięcia danych, gdy nie są już niezbędne lub cofasz zgodę.</li>
              <li style={li}><strong style={{ color: '#f1f5f9' }}>Ograniczenie przetwarzania (art. 18)</strong> — prawo do żądania wstrzymania przetwarzania w określonych sytuacjach.</li>
              <li style={li}><strong style={{ color: '#f1f5f9' }}>Przenoszalność (art. 20)</strong> — prawo do otrzymania danych w ustrukturyzowanym formacie (JSON).</li>
              <li style={li}><strong style={{ color: '#f1f5f9' }}>Sprzeciw (art. 21)</strong> — prawo do sprzeciwu wobec przetwarzania opartego na prawnie uzasadnionym interesie.</li>
              <li style={li}><strong style={{ color: '#f1f5f9' }}>Interwencja ludzka (art. 22)</strong> — prawo do zakwestionowania decyzji podjętej wyłącznie automatycznie (np. przez AutoMod).</li>
            </ul>
          </section>
          <section>
            <h2 style={h2}>9. Bezpieczeństwo danych</h2>
            <p style={p}>Stosujemy następujące środki ochrony danych:</p>
            <ul style={ul}>
              <li style={li}>Hasła przechowywane wyłącznie jako skróty bcrypt (koszt 12) — nigdy w formie jawnej.</li>
              <li style={li}>Cała komunikacja szyfrowana TLS 1.2+/HTTPS.</li>
              <li style={li}>Token sesji przechowywany w cookie HttpOnly — niedostępny dla JavaScript.</li>
              <li style={li}>Tokeny JWT podpisane kluczem HMAC-SHA256 z ograniczonym czasem ważności.</li>
              <li style={li}>Dostęp do bazy danych ograniczony do adresów IP serwerów aplikacji.</li>
              <li style={li}>Blokada konta po 5 nieudanych próbach logowania (15 minut) — zapisywana w bazie danych, odporna na restarty serwera.</li>
              <li style={li}>Monitorowanie podejrzanej aktywności: ban IP, rate limiting, detekcja flood.</li>
              <li style={li}>Tokeny weryfikacji e-mail jednorazowego użytku, ważne 24 godziny.</li>
              <li style={li}>Nagłówki bezpieczeństwa: HSTS, X-Frame-Options, X-Content-Type-Options, CORP, COOP.</li>
            </ul>
          </section>
          <section>
            <h2 style={h2}>10. Osoby niepełnoletnie</h2>
            <p style={p}>Platforma nie jest przeznaczona dla osób poniżej 13 roku życia. Osoby w wieku 13–15 lat mogą korzystać z Platformy wyłącznie za zgodą rodzica lub opiekuna prawnego, zgodnie z art. 8 RODO.</p>
            <p style={p}>Jeśli masz podstawy sądzić, że dziecko poniżej 13 lat posiada konto, skontaktuj się z nami pod adresem <a href="mailto:kontakt@project-z.cloud" style={link}>kontakt@project-z.cloud</a> — usuniemy konto niezwłocznie.</p>
          </section>
          <section>
            <h2 style={h2}>11. Zmiany Polityki prywatności</h2>
            <p style={p}>O istotnych zmianach tej Polityki poinformujemy e-mailem lub komunikatem w aplikacji z wyprzedzeniem co najmniej <strong>14 dni</strong> przed ich wejściem w życie.</p>
          </section>
          <section>
            <h2 style={h2}>12. Skarga do organu nadzorczego</h2>
            <p style={p}>Jeśli uważasz, że przetwarzamy Twoje dane niezgodnie z prawem, masz prawo wnieść skargę do Prezesa UODO:</p>
            <ul style={ul}>
              <li style={li}>Adres: ul. Stawki 2, 00-193 Warszawa</li>
              <li style={li}>Strona: <a href="https://uodo.gov.pl" target="_blank" rel="noreferrer" style={link}>uodo.gov.pl</a></li>
              <li style={li}>E-mail: <a href="mailto:kancelaria@uodo.gov.pl" style={link}>kancelaria@uodo.gov.pl</a></li>
            </ul>
            <p style={p}>Zachęcamy jednak do uprzedniego kontaktu z nami — postaramy się rozwiązać problem bezpośrednio.</p>
          </section>
        </div>

        <div style={{ marginTop: 48, paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <Link href={termsHref} style={link}>{termsLabel}</Link>
          <Link href="/" style={{ ...link, color: '#64748b' }}>{backApp}</Link>
        </div>
      </div>
    </div>
  )
}

export default function PrivacyPage() {
  return <Suspense><PrivacyContent /></Suspense>
}

const h2: React.CSSProperties = { margin: '0 0 12px', fontSize: 18, fontWeight: 600, color: '#f1f5f9' }
const p:  React.CSSProperties = { margin: '0 0 10px', fontSize: 14, color: '#94a3b8' }
const ul: React.CSSProperties = { margin: '0 0 10px', paddingLeft: 20 }
const li: React.CSSProperties = { fontSize: 14, color: '#94a3b8', marginBottom: 8 }
const link: React.CSSProperties = { color: '#f59e0b', textDecoration: 'none' }
