import nodemailer from 'nodemailer'

const SMTP_HOST = process.env.SMTP_HOST
const SMTP_PORT = Number(process.env.SMTP_PORT ?? 587)
const SMTP_USER = process.env.SMTP_USER
const SMTP_PASS = process.env.SMTP_PASS
const SMTP_FROM = process.env.SMTP_FROM ?? `"Project-Z" <noreply@project-z.cloud>`
const APP_URL   = process.env.FRONTEND_URL ?? 'https://project-z.cloud'

const canSend = !!(SMTP_HOST && SMTP_USER && SMTP_PASS)

const transporter = canSend
  ? nodemailer.createTransport({
      host:   SMTP_HOST,
      port:   SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth:   { user: SMTP_USER, pass: SMTP_PASS },
    })
  : null

export async function sendPasswordResetEmail(email: string, displayName: string, token: string): Promise<void> {
  const link = `${APP_URL}/auth/reset-password/${token}`

  if (!transporter) {
    console.log(`[mailer] SMTP not configured — reset link for ${email}:`)
    console.log(`[mailer] ${link}`)
    return
  }

  await transporter.sendMail({
    from: SMTP_FROM,
    to: email,
    subject: 'Resetowanie hasla w Project-Z',
    text: `Czesc, ${displayName}!\n\nOtrzymalismy prosbe o reset hasla do Twojego konta.\nKliknij ponizszy link, aby ustawic nowe haslo:\n\n${link}\n\nLink wygasnie po 30 minutach.\n\nJesli nie prosilsz o reset hasla, zignoruj ta wiadomosc.\n\n© ${new Date().getFullYear()} Project-Z`,
    html: `
<!DOCTYPE html>
<html lang="pl">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f0a0f;font-family:'Segoe UI',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0a0f;padding:40px 20px">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#1a0f1a;border-radius:16px;border:1px solid rgba(220,38,38,0.25);overflow:hidden">
        <tr>
          <td style="background:linear-gradient(135deg,#dc2626,#f59e0b);padding:32px;text-align:center">
            <div style="width:56px;height:56px;background:rgba(0,0,0,0.25);border-radius:14px;display:inline-flex;align-items:center;justify-content:center;font-size:28px;font-weight:900;color:#fff;line-height:56px">N</div>
            <h1 style="margin:16px 0 0;color:#fff;font-size:22px;font-weight:700;letter-spacing:-0.3px">Project-Z</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 40px">
            <h2 style="margin:0 0 8px;color:#f1f5f9;font-size:20px;font-weight:600">Reset hasla</h2>
            <p style="margin:0 0 8px;color:#94a3b8;font-size:14px;line-height:1.6">Czesc, ${displayName}!</p>
            <p style="margin:0 0 24px;color:#94a3b8;font-size:14px;line-height:1.6">
              Otrzymalismy prosbe o reset hasla do Twojego konta. Kliknij ponizszy przycisk, aby ustawic nowe haslo.
            </p>
            <div style="text-align:center;margin:0 0 28px">
              <a href="${link}" style="display:inline-block;background:linear-gradient(135deg,#dc2626,#f59e0b);color:#fff;text-decoration:none;padding:14px 36px;border-radius:12px;font-size:15px;font-weight:600;letter-spacing:0.2px">
                Ustaw nowe haslo
              </a>
            </div>
            <p style="margin:0 0 8px;color:#64748b;font-size:12px;line-height:1.5">Jesli przycisk nie dziala, skopiuj i wklej link do przegladarki:</p>
            <p style="margin:0 0 28px;word-break:break-all"><a href="${link}" style="color:#f59e0b;font-size:12px;text-decoration:none">${link}</a></p>
            <div style="border-top:1px solid rgba(255,255,255,0.08);padding-top:20px">
              <p style="margin:0;color:#475569;font-size:11px;line-height:1.5">
                Link wygasnie po 30 minutach. Jesli nie prosilsz o reset hasla, zignoruj ta wiadomosc.
              </p>
            </div>
          </td>
        </tr>
        <tr>
          <td style="background:#0f0a0f;padding:20px 40px;text-align:center">
            <p style="margin:0;color:#334155;font-size:11px">
              © ${new Date().getFullYear()} Project-Z · <a href="${APP_URL}/terms" style="color:#475569;text-decoration:none">Regulamin</a> · <a href="${APP_URL}/privacy" style="color:#475569;text-decoration:none">Prywatnosc</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  })
}

export async function sendVerificationEmail(email: string, displayName: string, token: string): Promise<void> {
  const link = `${APP_URL}/auth/verify-email/${token}`

  if (!transporter) {
    console.log(`[mailer] SMTP not configured — verification link for ${email}:`)
    console.log(`[mailer] ${link}`)
    return
  }

  await transporter.sendMail({
    from:    SMTP_FROM,
    to:      email,
    subject: 'Potwierdz swoj adres e-mail w Nexus',
    text: `Czesc, ${displayName}!\n\nDziekujemy za rejestracje w Nexus.\nKliknij ponizszy link, aby potwierdzic swoj adres e-mail:\n\n${link}\n\nLink wygasnie po 24 godzinach.\n\nJesli nie zakladales konta w Nexus, zignoruj ta wiadomosc.\n\n© ${new Date().getFullYear()} Nexus`,
    html: `
<!DOCTYPE html>
<html lang="pl">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f0a0f;font-family:'Segoe UI',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0a0f;padding:40px 20px">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#1a0f1a;border-radius:16px;border:1px solid rgba(220,38,38,0.25);overflow:hidden">
        <tr>
          <td style="background:linear-gradient(135deg,#dc2626,#f59e0b);padding:32px;text-align:center">
            <div style="width:56px;height:56px;background:rgba(0,0,0,0.25);border-radius:14px;display:inline-flex;align-items:center;justify-content:center;font-size:28px;font-weight:900;color:#fff;line-height:56px">N</div>
            <h1 style="margin:16px 0 0;color:#fff;font-size:22px;font-weight:700;letter-spacing:-0.3px">Nexus</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 40px">
            <h2 style="margin:0 0 8px;color:#f1f5f9;font-size:20px;font-weight:600">Czesc, ${displayName}!</h2>
            <p style="margin:0 0 24px;color:#94a3b8;font-size:14px;line-height:1.6">
              Dziękujemy za rejestrację w Nexus. Kliknij poniższy przycisk, aby potwierdzić swój adres e-mail i aktywować konto.
            </p>
            <div style="text-align:center;margin:0 0 28px">
              <a href="${link}" style="display:inline-block;background:linear-gradient(135deg,#dc2626,#f59e0b);color:#fff;text-decoration:none;padding:14px 36px;border-radius:12px;font-size:15px;font-weight:600;letter-spacing:0.2px">
                Potwierdz adres e-mail
              </a>
            </div>
            <p style="margin:0 0 8px;color:#64748b;font-size:12px;line-height:1.5">
              Jeśli przycisk nie działa, skopiuj i wklej poniższy link do przeglądarki:
            </p>
            <p style="margin:0 0 28px;word-break:break-all">
              <a href="${link}" style="color:#f59e0b;font-size:12px;text-decoration:none">${link}</a>
            </p>
            <div style="border-top:1px solid rgba(255,255,255,0.08);padding-top:20px">
              <p style="margin:0;color:#475569;font-size:11px;line-height:1.5">
                Link wygaśnie po 24 godzinach. Jeśli nie zakładałeś konta w Nexus, zignoruj tę wiadomość.
              </p>
            </div>
          </td>
        </tr>
        <tr>
          <td style="background:#0f0a0f;padding:20px 40px;text-align:center">
            <p style="margin:0;color:#334155;font-size:11px">
              © ${new Date().getFullYear()} Nexus · <a href="${APP_URL}/terms" style="color:#475569;text-decoration:none">Regulamin</a> · <a href="${APP_URL}/privacy" style="color:#475569;text-decoration:none">Prywatność</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  })
}
