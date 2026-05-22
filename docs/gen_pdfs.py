import os
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, HRFlowable
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# Register fonts
pdfmetrics.registerFont(TTFont('Arial', 'C:/Windows/Fonts/arial.ttf'))
pdfmetrics.registerFont(TTFont('Arial-Bold', 'C:/Windows/Fonts/arialbd.ttf'))
pdfmetrics.registerFont(TTFont('Arial-Italic', 'C:/Windows/Fonts/ariali.ttf'))

# Colors
DARK_BLUE = colors.HexColor('#1e3a5f')
MED_BLUE = colors.HexColor('#2d6a9f')
LIGHT_BLUE = colors.HexColor('#e8f0fe')
ACCENT = colors.HexColor('#f59e0b')
WHITE = colors.white
GRAY = colors.HexColor('#f5f5f5')
DARK_GRAY = colors.HexColor('#333333')
TABLE_HEADER = colors.HexColor('#1e3a5f')
TABLE_ALT = colors.HexColor('#f0f4f8')

os.makedirs(r'C:\Users\ahsru\Desktop\projekt Z\docs', exist_ok=True)

def make_styles():
    styles = {}
    styles['title'] = ParagraphStyle('title', fontName='Arial-Bold', fontSize=28, textColor=WHITE, spaceAfter=6, leading=34)
    styles['subtitle'] = ParagraphStyle('subtitle', fontName='Arial', fontSize=14, textColor=LIGHT_BLUE, spaceAfter=4)
    styles['confidential'] = ParagraphStyle('confidential', fontName='Arial-Italic', fontSize=10, textColor=colors.HexColor('#f59e0b'), spaceAfter=4)
    styles['h1'] = ParagraphStyle('h1', fontName='Arial-Bold', fontSize=16, textColor=WHITE, spaceBefore=16, spaceAfter=8, leading=20, backColor=DARK_BLUE, leftIndent=-20, rightIndent=-20, borderPad=8)
    styles['h2'] = ParagraphStyle('h2', fontName='Arial-Bold', fontSize=13, textColor=DARK_BLUE, spaceBefore=12, spaceAfter=6, borderPadding=(0,0,2,0))
    styles['h3'] = ParagraphStyle('h3', fontName='Arial-Bold', fontSize=11, textColor=MED_BLUE, spaceBefore=8, spaceAfter=4)
    styles['body'] = ParagraphStyle('body', fontName='Arial', fontSize=10, textColor=DARK_GRAY, spaceAfter=4, leading=15)
    styles['bullet'] = ParagraphStyle('bullet', fontName='Arial', fontSize=10, textColor=DARK_GRAY, spaceAfter=3, leftIndent=15, leading=14, bulletIndent=5)
    styles['code'] = ParagraphStyle('code', fontName='Courier', fontSize=9, textColor=DARK_GRAY, spaceAfter=4, leading=13, backColor=GRAY, leftIndent=10, rightIndent=10, borderPad=6)
    styles['footer'] = ParagraphStyle('footer', fontName='Arial', fontSize=8, textColor=colors.gray)
    styles['toc_title'] = ParagraphStyle('toc_title', fontName='Arial-Bold', fontSize=13, textColor=DARK_BLUE, spaceAfter=8, spaceBefore=8)
    styles['toc_item'] = ParagraphStyle('toc_item', fontName='Arial', fontSize=10, textColor=DARK_GRAY, spaceAfter=4, leftIndent=10)
    return styles

def make_table(data, col_widths=None, has_header=True):
    if col_widths is None:
        n = len(data[0])
        col_widths = [16*cm/n]*n
    t = Table(data, colWidths=col_widths)
    style = [
        ('FONTNAME', (0,0), (-1,-1), 'Arial'),
        ('FONTSIZE', (0,0), (-1,-1), 9),
        ('TEXTCOLOR', (0,0), (-1,-1), DARK_GRAY),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cccccc')),
    ]
    if has_header:
        style += [
            ('BACKGROUND', (0,0), (-1,0), TABLE_HEADER),
            ('TEXTCOLOR', (0,0), (-1,0), WHITE),
            ('FONTNAME', (0,0), (-1,0), 'Arial-Bold'),
        ]
        for i in range(1, len(data)):
            if i % 2 == 0:
                style.append(('BACKGROUND', (0,i), (-1,i), TABLE_ALT))
    t.setStyle(TableStyle(style))
    return t

def add_page_number(canvas, doc):
    canvas.saveState()
    canvas.setFont('Arial', 8)
    canvas.setFillColor(colors.gray)
    page_num = canvas.getPageNumber()
    canvas.drawString(2*cm, 1.2*cm, doc.title_text if hasattr(doc, 'title_text') else '')
    canvas.drawRightString(19*cm, 1.2*cm, f'Strona {page_num}')
    canvas.setStrokeColor(colors.HexColor('#cccccc'))
    canvas.line(2*cm, 1.6*cm, 19*cm, 1.6*cm)
    canvas.restoreState()

def cover_page(styles, title, subtitle, version, doc_type):
    story = []
    story.append(Spacer(1, 3*cm))
    # Blue cover block
    cover_data = [[Paragraph(title, styles['title'])],
                  [Paragraph(subtitle, styles['subtitle'])],
                  [Paragraph(version, styles['subtitle'])]]
    cover_table = Table(cover_data, colWidths=[17*cm])
    cover_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), DARK_BLUE),
        ('LEFTPADDING', (0,0), (-1,-1), 20),
        ('RIGHTPADDING', (0,0), (-1,-1), 20),
        ('TOPPADDING', (0,0), (0,0), 20),
        ('BOTTOMPADDING', (0,-1), (-1,-1), 20),
        ('TOPPADDING', (0,1), (-1,-1), 5),
    ]))
    story.append(cover_table)
    story.append(Spacer(1, 0.5*cm))
    accent_bar = Table([['']], colWidths=[17*cm], rowHeights=[0.3*cm])
    accent_bar.setStyle(TableStyle([('BACKGROUND', (0,0), (-1,-1), ACCENT)]))
    story.append(accent_bar)
    story.append(Spacer(1, 1*cm))
    story.append(Paragraph('Dokument poufny — przeznaczony dla partnerow biznesowych', styles['confidential']))
    story.append(Paragraph('Wszelkie prawa zastrzezone | 2026', styles['body']))
    story.append(PageBreak())
    return story

# ============================================================
# DOCUMENT 1: BUSINESS PLAN
# ============================================================
def build_biznesplan():
    path = r'C:\Users\ahsru\Desktop\projekt Z\docs\Biznesplan_Platforma_Komunikacyjna.pdf'
    doc = SimpleDocTemplate(path, pagesize=A4,
                            leftMargin=2*cm, rightMargin=2*cm,
                            topMargin=2.5*cm, bottomMargin=2.5*cm)
    doc.title_text = 'Biznesplan | Platforma Komunikacyjna | v1.0'
    S = make_styles()
    story = []

    # Cover
    story += cover_page(S, 'BIZNESPLAN', 'Platforma Komunikacyjna SaaS', 'Wersja 1.0  |  Maj 2026', 'biznesplan')

    # TOC
    story.append(Paragraph('SPIS TRESCI', S['toc_title']))
    toc_items = [
        '1. Streszczenie wykonawcze',
        '2. Opis produktu',
        '3. Rynek docelowy',
        '4. Model biznesowy',
        '5. Strategia go-to-market',
        '6. Infrastruktura i operacje',
        '7. Analiza konkurencji',
        '8. Ryzyka i mitigacja',
        '9. Podsumowanie',
    ]
    for item in toc_items:
        story.append(Paragraph(item, S['toc_item']))
    story.append(PageBreak())

    # 1. Streszczenie
    story.append(Paragraph('1.  STRESZCZENIE WYKONAWCZE', S['h1']))
    story.append(Paragraph('Platforma komunikacyjna SaaS umozliwiajaca firmom i spolecznosciom uruchamianie wlasnych, izolowanych serwerow komunikacyjnych (czat tekstowy, glos, wideo, udostepnianie ekranu). Model biznesowy oparty na subskrypcji — klient wykupuje dedykowana instancje serwerowa automatycznie provisionowana przez API.', S['body']))
    story.append(Spacer(1, 0.3*cm))
    story.append(Paragraph('Kluczowe przewagi:', S['h3']))
    for b in ['Pelna izolacja danych klienta (dedykowany serwer per klient)', 'Automatyczne provisionowanie — zero recznej pracy operacyjnej', 'Funkcjonalnosc porownywalna z Discord przy wlasnej infrastrukturze', 'Niski prog wejscia cenowego (~$4-5/mies. dla 10 uzytkownikow)']:
        story.append(Paragraph(f'• {b}', S['bullet']))

    # 2. Opis produktu
    story.append(Paragraph('2.  OPIS PRODUKTU', S['h1']))
    story.append(Paragraph('2.1  Czym jest platforma', S['h2']))
    story.append(Paragraph('Platforma komunikacyjna to kompletne rozwiazanie dla firm, spolecznosci gamingowych, organizacji i zespolow, ktore chca miec wlasny, prywatny komunikator z pelna kontrola nad danymi. W odroznieniu od Discord czy Slack — dane klienta nigdy nie opuszczaja jego dedykowanego serwera.', S['body']))
    story.append(Paragraph('2.2  Kluczowe funkcjonalnosci', S['h2']))
    for f in ['Czat tekstowy z kanalami, watkami, reakcjami i ankietami', 'Komunikacja glosowa i wideo (technologia WebRTC/LiveKit)', 'Udostepnianie ekranu w czasie rzeczywistym', 'System rol i uprawnien z granularna kontrola', 'Powiadomienia i wzmianki uzytkownikow', 'Wyszukiwanie wiadomosci (indeks pelnotekstowy)', 'Aplikacja desktopowa Windows z push-to-talk (PTT)', 'Panel administratora serwera', 'Forum i kanaly ogloszenione']:
        story.append(Paragraph(f'• {f}', S['bullet']))
    story.append(Paragraph('2.3  Modele dostepu', S['h2']))
    for m in ['Przegladarka internetowa (web app — Vercel CDN)', 'Aplikacja desktopowa Windows (Electron)', 'Planowane: aplikacja mobilna iOS/Android']:
        story.append(Paragraph(f'• {m}', S['bullet']))

    # 3. Rynek
    story.append(Paragraph('3.  RYNEK DOCELOWY', S['h1']))
    story.append(Paragraph('3.1  Segmenty klientow', S['h2']))
    segments = [
        ('Segment A — Spolecznosci gamingowe', 'Grupy graczy szukajace alternatywy dla Discord z wlasna infrastruktura. Motywacja: prywatnosc, brak reklam, wlasna kontrola nad serwerem.'),
        ('Segment B — Male i srednie firmy', 'Zespoly 10-200 pracownikow szukajace bezpiecznej komunikacji wewnetrznej. Motywacja: RODO, bezpieczenstwo danych, brak vendor lock-in.'),
        ('Segment C — Organizacje i stowarzyszenia', 'Kluby sportowe, organizacje non-profit, uczelnie szukajace wlasnej platformy pod wlasna marka.'),
        ('Segment D — Tworcy i streamerzy', 'Budowanie spolecznosci wokol wlasnej marki. Motywacja: brak algorytmow, pelna wlasnosc spolecznosci.'),
    ]
    for seg_title, seg_body in segments:
        story.append(Paragraph(seg_title, S['h3']))
        story.append(Paragraph(seg_body, S['body']))
    story.append(Paragraph('3.2  Rozmiar rynku', S['h2']))
    for r in ['Globalny rynek komunikacji zespolowej (2025): ~$25 miliardow', 'Segment self-hosted / prywatne instancje: rosnacy trend po aferach prywatnosci', 'Polska: ~2 mln aktywnych uzytkownikow Discord, ~500 tys. firm MSP']:
        story.append(Paragraph(f'• {r}', S['bullet']))

    # 4. Model biznesowy
    story.append(Paragraph('4.  MODEL BIZNESOWY', S['h1']))
    story.append(Paragraph('4.1  Struktura cenowa (subskrypcja miesieczna)', S['h2']))
    pricing_data = [
        ['Plan', 'Uzytkownicy', 'Cena/mies.', 'Koszt wlasny', 'Marza'],
        ['Starter', '10', '$5', '~$1.50', '~70%'],
        ['Standard', '50', '$15', '~$5', '~67%'],
        ['Pro', '200', '$40', '~$15', '~63%'],
        ['Enterprise', '500+', '$100', '~$35', '~65%'],
    ]
    story.append(make_table(pricing_data, [3.5*cm, 3.5*cm, 3*cm, 3.5*cm, 3*cm]))
    story.append(Spacer(1, 0.3*cm))
    story.append(Paragraph('4.2  Zrodla przychodow', S['h2']))
    for src in ['Subskrypcje miesieczne (glowne zrodlo przychodow)', 'Roczne plany z rabatem 15%', 'Uslugi migracji i konfiguracji (jednorazowe)', 'Wsparcie techniczne premium (opcja dodatkowa)']:
        story.append(Paragraph(f'• {src}', S['bullet']))
    story.append(Paragraph('4.3  Prognozy finansowe', S['h2']))
    fin_data = [
        ['Rok', 'Subskrypcje', 'Przychod roczny', 'Koszty infra', 'Zysk brutto'],
        ['Rok 1', '100', '$14,400', '$3,600', '$10,800'],
        ['Rok 2', '500', '$72,000', '$18,000', '$54,000'],
        ['Rok 3', '2,000', '$288,000', '$70,000', '$218,000'],
    ]
    story.append(make_table(fin_data, [2.5*cm, 3*cm, 4*cm, 3.5*cm, 3.5*cm]))

    # 5. Go-to-market
    story.append(Paragraph('5.  STRATEGIA GO-TO-MARKET', S['h1']))
    phases = [
        ('Faza 1 — Beta i walidacja (miesiace 1-3)', ['Zamknieta beta z 20-50 wybranymi spolecznosciami', 'Zbieranie feedbacku i iteracja produktu', 'Budowanie case studies i testimoniali']),
        ('Faza 2 — Soft launch (miesiace 4-6)', ['Publiczny launch z planem Starter', 'Marketing w spolecznosciach gamingowych (Reddit, fora, Discord)', 'Program referralny: 1 miesiac gratis za polecenie']),
        ('Faza 3 — Skalowanie (miesiace 7-12)', ['Kampanie B2B skierowane do MSP', 'Partnerstwa z agencjami cyfrowymi', 'Content marketing (porownania z Discord/Slack)']),
    ]
    for phase_title, phase_items in phases:
        story.append(Paragraph(phase_title, S['h3']))
        for item in phase_items:
            story.append(Paragraph(f'• {item}', S['bullet']))
    story.append(Paragraph('5.4  Kanaly dystrybucji', S['h2']))
    for ch in ['Strona produktowa z self-service onboarding', 'Microsoft Store dla aplikacji desktopowej', 'Partnerzy resellerzy', 'Direct sales dla klientow Enterprise']:
        story.append(Paragraph(f'• {ch}', S['bullet']))

    # 6. Infrastruktura
    story.append(Paragraph('6.  INFRASTRUKTURA I OPERACJE', S['h1']))
    story.append(Paragraph('6.1  Model provisionowania', S['h2']))
    story.append(Paragraph('Kazdy klient po zakupie subskrypcji otrzymuje automatycznie dedykowany serwer VPS z zainstalowanym i skonfigurowanym pelnym stackiem aplikacyjnym, wlasna domena lub subdomena oraz certyfikatem SSL. Czas od zakupu do gotowego serwera wynosi ponizej 3 minut.', S['body']))
    story.append(Paragraph('6.2  Partnerzy infrastrukturalni', S['h2']))
    for p in ['Serwery VPS: OVH / Hetzner (negocjacje w toku)', 'Przechowywanie plikow: Cloudflare R2 (darmowy egress)', 'Frontend: Vercel (CDN globalny, wspoldzielony)', 'Voice/Video: LiveKit SFU (self-hosted na serwerach klientow)']:
        story.append(Paragraph(f'• {p}', S['bullet']))
    story.append(Paragraph('6.3  Bezpieczenstwo', S['h2']))
    for s in ['Izolacja per klient — dedykowane VPS, osobne bazy danych', 'Szyfrowanie end-to-end dla glosu (DTLS-SRTP)', 'Certyfikaty SSL/TLS dla wszystkich polaczen', 'Backup danych co 24 godziny', 'Zgodnosc z RODO (dane w europejskich datacenter)']:
        story.append(Paragraph(f'• {s}', S['bullet']))

    # 7. Konkurencja
    story.append(Paragraph('7.  ANALIZA KONKURENCJI', S['h1']))
    comp_data = [
        ['Konkurent', 'Cena', 'Wlasna infra', 'Glos/Wideo', 'Glowne slabosci'],
        ['Discord', 'Darmowy / $10', 'NIE', 'TAK', 'Brak prywatnosci, reklamy'],
        ['Slack', '$7-13/user', 'NIE', 'Ograniczony', 'Drogi, vendor lock-in'],
        ['Rocket.Chat', '$4/user', 'TAK', 'Slaby', 'Skomplikowana instalacja'],
        ['Matrix/Element', 'Darmowy', 'TAK', 'TAK', 'Trudny w konfiguracji'],
        ['Nasza platforma', '$5-100/serwer', 'TAK', 'TAK', 'Nowa marka'],
    ]
    story.append(make_table(comp_data, [3.5*cm, 3*cm, 2.5*cm, 2.5*cm, 5*cm]))
    story.append(Spacer(1, 0.3*cm))
    story.append(Paragraph('Przewaga konkurencyjna:', S['h3']))
    for adv in ['Prostota — serwer gotowy w 3 minuty bez wiedzy technicznej', 'Cena — taniej niz Slack per uzytkownik przy wiekszych zespolach', 'Prywatnosc — dane wylacznie na serwerze klienta', 'Aplikacja desktopowa — PTT, integracja systemowa']:
        story.append(Paragraph(f'• {adv}', S['bullet']))

    # 8. Ryzyka
    story.append(Paragraph('8.  RYZYKA I MITIGACJA', S['h1']))
    risk_data = [
        ['Ryzyko', 'Prawdopodobienstwo', 'Mitigacja'],
        ['Dominacja Discord na rynku', 'Wysokie', 'Fokus na prywatnosc i segment B2B'],
        ['Problemy techniczne przy skalowaniu', 'Srednie', 'Automatyczny monitoring i failover'],
        ['Zmiana cen przez dostawcow VPS', 'Niskie', 'Umowy dlugoterminowe, multi-vendor'],
        ['Naruszenie bezpieczenstwa', 'Niskie', 'Izolacja per klient, regularne audyty'],
    ]
    story.append(make_table(risk_data, [5.5*cm, 4*cm, 7*cm]))

    # 9. Podsumowanie
    story.append(Paragraph('9.  PODSUMOWANIE', S['h1']))
    story.append(Paragraph('Platforma adresuje rosnace zapotrzebowanie na prywatne, wlasne rozwiazania komunikacyjne. Automatyzacja provisionowania eliminuje koszty operacyjne i umozliwia skalowanie bez proporcjonalnego wzrostu zatrudnienia.', S['body']))
    story.append(Paragraph('Model subskrypcyjny zapewnia przewidywalne przychody przy wysokich marzach (60-70%). Izolacja danych per klient stanowi kluczowa przewage nad konkurencja w segmencie B2B i organizacji dbajacych o prywatnosc.', S['body']))
    story.append(Spacer(1, 0.5*cm))
    summary_data = [['Marza brutto', 'Czas do gotowego serwera', 'Cel rok 1', 'Koszt minimalny per klient'],
                    ['60-70%', '< 3 minuty', '100 subskrypcji', '~$1.50/mies.']]
    story.append(make_table(summary_data, [4*cm, 4.5*cm, 4*cm, 4*cm]))

    doc.build(story, onFirstPage=add_page_number, onLaterPages=add_page_number)
    print(f'OK: {path}')

# ============================================================
# DOCUMENT 2: TECHNICAL DOCUMENTATION
# ============================================================
def build_dokumentacja():
    path = r'C:\Users\ahsru\Desktop\projekt Z\docs\Dokumentacja_Techniczna.pdf'
    doc = SimpleDocTemplate(path, pagesize=A4,
                            leftMargin=2*cm, rightMargin=2*cm,
                            topMargin=2.5*cm, bottomMargin=2.5*cm)
    doc.title_text = 'Dokumentacja Techniczna | Platforma Komunikacyjna | v1.0'
    S = make_styles()
    story = []

    story += cover_page(S, 'DOKUMENTACJA TECHNICZNA', 'Platforma Komunikacyjna', 'Wersja 1.0  |  Maj 2026', 'techniczna')

    # TOC
    story.append(Paragraph('SPIS TRESCI', S['toc_title']))
    for item in ['1. Architektura systemu', '2. Stack technologiczny', '3. Schemat bazy danych', '4. API REST — endpointy', '5. Komunikacja real-time (Socket.IO)', '6. Wymagania serwerowe', '7. Provisioning — flow automatyczny', '8. Bezpieczenstwo', '9. Skalowanie', '10. Monitoring i dostepnosc']:
        story.append(Paragraph(item, S['toc_item']))
    story.append(PageBreak())

    # 1. Architektura
    story.append(Paragraph('1.  ARCHITEKTURA SYSTEMU', S['h1']))
    story.append(Paragraph('1.1  Przeglad architektury', S['h2']))
    story.append(Paragraph('System sklada sie z dwoch warstw:', S['body']))
    story.append(Paragraph('Warstwa zarzadzania (operator platformy):', S['h3']))
    for item in ['Panel administracyjny do zarzadzania klientami i subskrypcjami', 'System billing i platnosci', 'API provisionowania (automatyczne tworzenie serwerow klientow)', 'Frontend aplikacji (Vercel CDN — wspoldzielony)']:
        story.append(Paragraph(f'• {item}', S['bullet']))
    story.append(Paragraph('Warstwa klienta (dedykowana per klient):', S['h3']))
    for item in ['Serwer VPS z pelnym stackiem aplikacyjnym', 'Izolowana baza danych MySQL', 'Serwer glosowy LiveKit SFU', 'Serwer TURN (coturn) dla NAT traversal']:
        story.append(Paragraph(f'• {item}', S['bullet']))
    story.append(Paragraph('1.2  Diagram architektury', S['h2']))
    arch_text = (
        'OPERATOR PLATFORMY\n'
        'Panel zarzadzania | Billing | Provisioning API | Frontend (Vercel)\n'
        '                     |\n'
        '        provisionuje nowe serwery VPS\n'
        '                     |\n'
        '    +----------------+----------------+\n'
        '    |                |                |\n'
        'KLIENT A         KLIENT B         KLIENT C\n'
        'Node.js          Node.js          Node.js\n'
        'MySQL            MySQL            MySQL\n'
        'LiveKit          LiveKit          LiveKit\n'
        'coturn           coturn           coturn\n'
        'VPS 3.79EUR      VPS 3.79EUR      VPS 3.79EUR'
    )
    story.append(Paragraph(arch_text.replace('\n', '<br/>'), S['code']))

    # 2. Stack technologiczny
    story.append(Paragraph('2.  STACK TECHNOLOGICZNY', S['h1']))
    story.append(Paragraph('2.1  Frontend', S['h2']))
    fe_data = [['Technologia', 'Wersja', 'Zastosowanie'],
               ['Next.js', '14.2', 'Framework React, SSR/SSG'],
               ['TypeScript', '5.x', 'Typowanie statyczne'],
               ['Tailwind CSS', '3.x', 'Stylowanie komponentow'],
               ['Zustand', '4.5', 'Zarzadzanie stanem aplikacji'],
               ['Socket.IO Client', '4.7', 'WebSocket komunikacja real-time'],
               ['LiveKit Client SDK', '2.5', 'Glos i wideo (WebRTC)']]
    story.append(make_table(fe_data, [5*cm, 3*cm, 8.5*cm]))
    story.append(Spacer(1, 0.3*cm))
    story.append(Paragraph('2.2  Backend', S['h2']))
    be_data = [['Technologia', 'Wersja', 'Zastosowanie'],
               ['Node.js', '20 LTS', 'Srodowisko uruchomieniowe'],
               ['Express', '4.x', 'HTTP API REST'],
               ['TypeScript', '5.x', 'Typowanie statyczne'],
               ['Socket.IO', '4.7', 'Real-time WebSocket'],
               ['MySQL2', '3.x', 'Sterownik bazy danych'],
               ['LiveKit Server SDK', '2.x', 'Zarzadzanie pokojami glosowymi'],
               ['JWT', '9.x', 'Autentykacja tokenowa'],
               ['bcrypt', '5.x', 'Hashowanie hasel'],
               ['multer', '1.x', 'Upload plikow']]
    story.append(make_table(be_data, [5*cm, 3*cm, 8.5*cm]))
    story.append(Spacer(1, 0.3*cm))
    story.append(Paragraph('2.3  Infrastruktura', S['h2']))
    infra_data = [['Technologia', 'Zastosowanie'],
                  ['MySQL 8.0', 'Relacyjna baza danych'],
                  ['LiveKit SFU', 'Selective Forwarding Unit (glos/wideo)'],
                  ['coturn', 'Serwer TURN/STUN dla NAT traversal'],
                  ['Docker + Compose', 'Konteneryzacja calego stacku klienta'],
                  ['nginx', 'Reverse proxy, SSL termination'],
                  ["Let's Encrypt", 'Automatyczne certyfikaty SSL']]
    story.append(make_table(infra_data, [5*cm, 11.5*cm]))
    story.append(Spacer(1, 0.3*cm))
    story.append(Paragraph('2.4  Aplikacja desktopowa', S['h2']))
    desk_data = [['Technologia', 'Zastosowanie'],
                 ['Electron 31', 'Wrapper desktopowy (Windows)'],
                 ['electron-updater', 'Automatyczne aktualizacje aplikacji'],
                 ['uiohook-napi', 'Globalne skroty klawiszowe (PTT)'],
                 ['electron-builder', 'Budowanie instalatora NSIS']]
    story.append(make_table(desk_data, [5*cm, 11.5*cm]))

    # 3. Baza danych
    story.append(Paragraph('3.  SCHEMAT BAZY DANYCH', S['h1']))
    story.append(Paragraph('3.1  Glowne tabele', S['h2']))
    db_data = [['Tabela', 'Opis'],
               ['users', 'Konta uzytkownikow, autentykacja, profile, statusy'],
               ['servers', 'Serwery komunikacyjne (plany: free/standard/pro)'],
               ['server_members', 'Czlonkostwo uzytkownikow w serwerach'],
               ['roles', 'Role z granularnym systemem uprawnien (JSON)'],
               ['channels', 'Kanaly (text/voice/announcement/forum/stage)'],
               ['messages', 'Wiadomosci z obsuga watkow i odpowiedzi'],
               ['reactions', 'Reakcje emoji na wiadomosci'],
               ['polls / poll_options / poll_votes', 'Kompletny system ankiet'],
               ['message_attachments', 'Zalaczniki plikow i obrazow'],
               ['notifications', 'Powiadomienia (wzmianki, odpowiedzi, reakcje)'],
               ['voice_states', 'Aktualny stan uzytkownikow na kanalach glosowych']]
    story.append(make_table(db_data, [5.5*cm, 11*cm]))
    story.append(Spacer(1, 0.3*cm))
    story.append(Paragraph('3.2  Indeksy wydajnosciowe', S['h2']))
    idx_data = [['Indeks', 'Tabela / Kolumny', 'Cel'],
                ['idx_channel_created', 'messages(channel_id, created_at DESC)', 'Stronicowanie wiadomosci'],
                ['idx_reactions_msg', 'reactions(message_id)', 'Batch pobieranie reakcji'],
                ['ft_messages_content', 'messages(content) FULLTEXT', 'Wyszukiwanie pelnotekstowe'],
                ['idx_polls_message', 'polls(message_id)', 'Pobieranie ankiet per wiadomosc'],
                ['idx_user_unread', 'notifications(user_id, read_at)', 'Licznik nieprzeczytanych']]
    story.append(make_table(idx_data, [4*cm, 6.5*cm, 6*cm]))

    # 4. API REST
    story.append(Paragraph('4.  API REST — ENDPOINTY', S['h1']))
    story.append(Paragraph('4.1  Autentykacja', S['h2']))
    auth_data = [['Metoda', 'Endpoint', 'Opis'],
                 ['POST', '/api/auth/register', 'Rejestracja nowego uzytkownika'],
                 ['POST', '/api/auth/login', 'Logowanie — zwraca token JWT'],
                 ['GET', '/api/auth/me', 'Dane zalogowanego uzytkownika']]
    story.append(make_table(auth_data, [2.5*cm, 6*cm, 8*cm]))
    story.append(Spacer(1, 0.3*cm))
    story.append(Paragraph('4.2  Serwery i kanaly', S['h2']))
    srv_data = [['Metoda', 'Endpoint', 'Opis'],
                ['GET', '/api/servers', 'Lista serwerow uzytkownika'],
                ['POST', '/api/servers', 'Utworz nowy serwer'],
                ['GET', '/api/servers/:id', 'Szczegoly serwera'],
                ['GET', '/api/servers/:id/channels', 'Lista kanalow serwera'],
                ['POST', '/api/servers/:id/channels', 'Utworz nowy kanal']]
    story.append(make_table(srv_data, [2.5*cm, 6*cm, 8*cm]))
    story.append(Spacer(1, 0.3*cm))
    story.append(Paragraph('4.3  Wiadomosci', S['h2']))
    msg_data = [['Metoda', 'Endpoint', 'Opis'],
                ['GET', '/api/channels/:id/messages', 'Pobierz wiadomosci (paginacja kursorowa)'],
                ['POST', '/api/channels/:id/messages', 'Wyslij wiadomosc (HTTP fallback)'],
                ['PATCH', '/api/channels/:id/messages/:msgId', 'Edytuj wiadomosc'],
                ['DELETE', '/api/channels/:id/messages/:msgId', 'Usun wiadomosc'],
                ['GET', '/api/servers/:id/search', 'Wyszukiwanie FULLTEXT']]
    story.append(make_table(msg_data, [2.5*cm, 7*cm, 7*cm]))
    story.append(Spacer(1, 0.3*cm))
    story.append(Paragraph('4.4  Glos', S['h2']))
    voice_data = [['Metoda', 'Endpoint', 'Opis'],
                  ['GET', '/api/livekit/token', 'Token dostepu do kanalu glosowego'],
                  ['DELETE', '/api/livekit/kick', 'Wyrzucenie uzytkownika z glosu']]
    story.append(make_table(voice_data, [2.5*cm, 6*cm, 8*cm]))

    # 5. Socket.IO
    story.append(Paragraph('5.  KOMUNIKACJA REAL-TIME (SOCKET.IO)', S['h1']))
    story.append(Paragraph('5.1  Zdarzenia klient do serwera', S['h2']))
    sock_out = [['Zdarzenie', 'Dane', 'Opis'],
                ['join_server', 'serverId', 'Dolacz do pokoju serwera'],
                ['join_channel', 'channelId', 'Dolacz do pokoju kanalu'],
                ['MESSAGE_CREATE', '{channelId, content, nonce}', 'Wyslij wiadomosc'],
                ['MESSAGE_UPDATE', '{messageId, channelId, content}', 'Edytuj wiadomosc'],
                ['MESSAGE_DELETE', '{messageId, channelId}', 'Usun wiadomosc'],
                ['REACTION_ADD', '{messageId, channelId, emoji}', 'Dodaj reakcje'],
                ['TYPING_START', '{channelId}', 'Wskaznik pisania']]
    story.append(make_table(sock_out, [4.5*cm, 6*cm, 6*cm]))
    story.append(Spacer(1, 0.3*cm))
    story.append(Paragraph('5.2  Zdarzenia serwera do klienta', S['h2']))
    sock_in = [['Zdarzenie', 'Opis'],
               ['MESSAGE_CREATE', 'Nowa wiadomosc od innego uzytkownika'],
               ['MESSAGE_UPDATE', 'Edycja wiadomosci'],
               ['MESSAGE_DELETE', 'Usuniecie wiadomosci — natychmiastowe u wszystkich'],
               ['REACTION_UPDATE', 'Aktualizacja reakcji na wiadomosci'],
               ['PRESENCE_UPDATE', 'Zmiana statusu uzytkownika (online/offline)'],
               ['NOTIFICATION', 'Nowe powiadomienie (wzmianka, odpowiedz, reakcja)'],
               ['TYPING_START / TYPING_STOP', 'Wskaznik pisania w czasie rzeczywistym']]
    story.append(make_table(sock_in, [6*cm, 10.5*cm]))

    # 6. Wymagania serwerowe
    story.append(Paragraph('6.  WYMAGANIA SERWEROWE', S['h1']))
    story.append(Paragraph('6.1  Minimalna specyfikacja per klient (10 uzytkownikow)', S['h2']))
    spec_data = [['Zasob', 'Minimum', 'Zalecane'],
                 ['vCPU', '2 rdzenie', '2 rdzenie'],
                 ['RAM', '2 GB', '4 GB'],
                 ['Dysk SSD', '20 GB', '40 GB'],
                 ['Transfer miesieczny', '1 TB', 'Unmetered'],
                 ['Port sieciowy', '100 Mbps', '1 Gbps']]
    story.append(make_table(spec_data, [5.5*cm, 5*cm, 6*cm]))
    story.append(Spacer(1, 0.3*cm))
    story.append(Paragraph('6.2  Zuzycie zasobow per komponent', S['h2']))
    res_data = [['Komponent', 'RAM', 'CPU idle', 'CPU peak'],
                ['Node.js + Socket.IO', '150-256 MB', '2%', '15%'],
                ['MySQL 8.0', '256-512 MB', '1%', '20%'],
                ['LiveKit SFU', '400-512 MB', '3%', '60%'],
                ['coturn (TURN/STUN)', '64 MB', '~0%', '5%'],
                ['System operacyjny', '256 MB', '2%', '—']]
    story.append(make_table(res_data, [5.5*cm, 3.5*cm, 3*cm, 3*cm]))
    story.append(Spacer(1, 0.3*cm))
    story.append(Paragraph('6.3  Rekomendowane serwery VPS', S['h2']))
    vps_data = [['Dostawca', 'Model', 'vCPU', 'RAM', 'Cena miesieczna'],
                ['Hetzner', 'CAX11 (ARM)', '2', '4 GB', '3.79 EUR'],
                ['Hetzner', 'CX22', '2', '4 GB', '4.51 EUR'],
                ['OVH', 'Starter-1', '1', '2 GB', '3.50 EUR']]
    story.append(make_table(vps_data, [3.5*cm, 3.5*cm, 2.5*cm, 2.5*cm, 4.5*cm]))

    # 7. Provisioning
    story.append(Paragraph('7.  PROVISIONING — FLOW AUTOMATYCZNY', S['h1']))
    story.append(Paragraph('7.1  Schemat procesu', S['h2']))
    steps = ['1.  Klient kupuje plan na platformie',
             '2.  System billing potwierdza platnosc',
             '3.  Provisioning API — POST /v1/servers (Hetzner lub OVH API)',
             '4.  Oczekiwanie na status "running" (~20-60 sekund)',
             '5.  SSH — wykonanie skryptu instalacyjnego na nowym VPS',
             '6.  docker-compose up (Node.js + MySQL + LiveKit + coturn)',
             '7.  Konfiguracja nginx + SSL via Let\'s Encrypt',
             '8.  Inicjalizacja bazy danych (schema.sql + migracje)',
             '9.  Wyslanie danych dostepowych do klienta (email)',
             '10. Serwer gotowy — czas od zakupu: ponizej 3 minut']
    for step in steps:
        story.append(Paragraph(step, S['bullet']))
    story.append(Spacer(1, 0.3*cm))
    story.append(Paragraph('7.2  Docker Compose — struktura serwisow', S['h2']))
    dc_text = ('version: "3.8"\nservices:\n'
               '  backend:   # Node.js API + Socket.IO — port 3001\n'
               '  db:        # MySQL 8.0 z wolumenem danych\n'
               '  livekit:   # LiveKit SFU — port 7880, UDP 7881, 50000-60000\n'
               '  coturn:    # TURN/STUN relay — UDP 3478')
    story.append(Paragraph(dc_text.replace('\n', '<br/>'), S['code']))

    # 8. Bezpieczenstwo
    story.append(Paragraph('8.  BEZPIECZENSTWO', S['h1']))
    sec_sections = [
        ('8.1  Autentykacja', ['JWT (JSON Web Tokens) z czasem wygasniecia', 'bcrypt dla hashowania hasel (salt rounds: 12)', 'Tokeny socket weryfikowane przy kazdym polaczeniu']),
        ('8.2  Autoryzacja', ['System rol z granularnym systemem uprawnien (JSON)', 'Weryfikacja uprawnien na kazdym endpoincie', 'Moderacja: mute, ban, kick z pelnym logowaniem']),
        ('8.3  Szyfrowanie komunikacji', ['HTTPS/WSS (TLS 1.2+) dla wszystkich polaczen HTTP i WebSocket', 'DTLS-SRTP dla strumieni audio/wideo (LiveKit)', 'Certyfikaty Let\'s Encrypt z automatycznym odnowieniem']),
        ('8.4  Izolacja danych', ['Kazdy klient = osobny serwer VPS = osobna baza danych', 'Brak mozliwosci dostepu cross-tenant', 'Dane nie opuszczaja serwera klienta (poza frontendem Vercel)']),
        ('8.5  Ochrona przed atakami', ['Rate limiting na endpointach API', 'Walidacja typow i rozmiarow uploadowanych plikow (max 8 MB)', 'Sanityzacja danych wejsciowych', 'DDoS protection przez dostawce VPS (Hetzner/OVH)']),
    ]
    for sec_title, sec_items in sec_sections:
        story.append(Paragraph(sec_title, S['h2']))
        for item in sec_items:
            story.append(Paragraph(f'• {item}', S['bullet']))

    # 9. Skalowanie
    story.append(Paragraph('9.  SKALOWANIE', S['h1']))
    story.append(Paragraph('9.1  Skalowanie poziome (wiele instancji Node.js)', S['h2']))
    for item in ['Dodanie Redis jako adaptera Socket.IO dla sesji wspoldzielonych', 'Load balancer nginx z upstream do wielu instancji', 'MySQL connection pooling dla optymalnego wykorzystania polaczen']:
        story.append(Paragraph(f'• {item}', S['bullet']))
    story.append(Paragraph('9.2  Storage plikow', S['h2']))
    story.append(Paragraph('Aktualne rozwiazanie: pliki przechowywane w MySQL jako MEDIUMBLOB — wystarczajace do ~100 GB per instancja.', S['body']))
    story.append(Paragraph('Planowane: migracja do Cloudflare R2 (object storage z darmowym egress) — redukcja obciazenia bazy i kosztow dysku.', S['body']))
    story.append(Spacer(1, 0.3*cm))
    story.append(Paragraph('9.3  Progi skalowania', S['h2']))
    scale_data = [['Liczba uzytkownikow', 'Zalecana konfiguracja'],
                  ['10', 'CX22 / CAX11 — konfiguracja standardowa'],
                  ['50', 'CX32 (4 vCPU, 8 GB RAM)'],
                  ['200', 'CX52 (8 vCPU, 16 GB RAM)'],
                  ['500+', 'Dedykowany serwer + Redis + MySQL repliki']]
    story.append(make_table(scale_data, [5.5*cm, 11*cm]))

    # 10. Monitoring
    story.append(Paragraph('10.  MONITORING I DOSTEPNOSC', S['h1']))
    story.append(Paragraph('10.1  Metryki do monitorowania', S['h2']))
    for m in ['Uzycie CPU i RAM — prog alertu przy >80%', 'Liczba aktywnych polaczen WebSocket', 'Rozmiar bazy danych i wolnego miejsca na dysku', 'Czas odpowiedzi API (p95 ponizej 200 ms)', 'Dostepnosc portu UDP dla glosu (LiveKit)', 'Aktywne sesje glosowe per klient']:
        story.append(Paragraph(f'• {m}', S['bullet']))
    story.append(Paragraph('10.2  SLA i dostepnosc', S['h2']))
    sla_data = [['Parametr', 'Wartosc'],
                ['Cel dostepnosci', '99.9% (< 9 godzin przestoju rocznie)'],
                ['Backup bazy danych', 'Co 24 godziny, retencja 7 dni'],
                ['Czas przywrocenia (RTO)', 'Ponizej 2 godzin'],
                ['Punkt przywrocenia (RPO)', 'Maksymalnie 24 godziny']]
    story.append(make_table(sla_data, [5.5*cm, 11*cm]))

    doc.build(story, onFirstPage=add_page_number, onLaterPages=add_page_number)
    print(f'OK: {path}')

build_biznesplan()
build_dokumentacja()
print('Oba dokumenty PDF zostaly wygenerowane.')
