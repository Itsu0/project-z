# -*- coding: utf-8 -*-
"""
Professional PDF generator for Nexus Communication Platform documents.
Uses Arial TTF from Windows Fonts for full Polish character support.
"""

import os
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm, mm
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable, KeepTogether
)
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import BaseDocTemplate, Frame, PageTemplate


# ── Font registration ──────────────────────────────────────────────────────────
FONTS_DIR = r"C:\Windows\Fonts"

pdfmetrics.registerFont(TTFont("Arial",        os.path.join(FONTS_DIR, "arial.ttf")))
pdfmetrics.registerFont(TTFont("Arial-Bold",   os.path.join(FONTS_DIR, "arialbd.ttf")))
pdfmetrics.registerFont(TTFont("Arial-Italic", os.path.join(FONTS_DIR, "ariali.ttf")))
pdfmetrics.registerFont(TTFont("Arial-BoldItalic", os.path.join(FONTS_DIR, "arialbi.ttf")))
pdfmetrics.registerFont(TTFont("Courier-TTF",  os.path.join(FONTS_DIR, "cour.ttf")))
pdfmetrics.registerFont(TTFont("Courier-Bold-TTF", os.path.join(FONTS_DIR, "courbd.ttf")))

pdfmetrics.registerFontFamily(
    "Arial",
    normal="Arial",
    bold="Arial-Bold",
    italic="Arial-Italic",
    boldItalic="Arial-BoldItalic",
)

# ── Color palette ──────────────────────────────────────────────────────────────
DARK_BLUE    = colors.HexColor("#1e3a5f")
MID_BLUE     = colors.HexColor("#2d6a9f")
LIGHT_BLUE   = colors.HexColor("#d6e4f0")
ACCENT_BLUE  = colors.HexColor("#4a90d9")
WHITE        = colors.white
BLACK        = colors.black
LIGHT_GRAY   = colors.HexColor("#f2f2f2")
MID_GRAY     = colors.HexColor("#cccccc")
DARK_GRAY    = colors.HexColor("#555555")
ROW_ALT      = colors.HexColor("#eaf2fb")
COVER_BG     = colors.HexColor("#0d2137")

PAGE_W, PAGE_H = A4


# ── Style catalogue ────────────────────────────────────────────────────────────
def build_styles():
    s = {}
    base = dict(fontName="Arial", leading=14, spaceAfter=4)

    s["Normal"] = ParagraphStyle("Normal", **base, fontSize=10, textColor=BLACK)
    s["NormalJustify"] = ParagraphStyle("NormalJustify", **base, fontSize=10,
                                        textColor=BLACK, alignment=TA_JUSTIFY, spaceAfter=8)
    s["Small"]  = ParagraphStyle("Small",  **base, fontSize=8,  textColor=DARK_GRAY)

    s["H1"] = ParagraphStyle("H1", fontName="Arial-Bold", fontSize=15,
                              textColor=WHITE, leading=20,
                              spaceBefore=2, spaceAfter=6,
                              leftIndent=0, backColor=DARK_BLUE,
                              borderPad=6)
    s["H2"] = ParagraphStyle("H2", fontName="Arial-Bold", fontSize=12,
                              textColor=DARK_BLUE, leading=16,
                              spaceBefore=14, spaceAfter=6,
                              borderPadding=(0, 0, 2, 0))
    s["H3"] = ParagraphStyle("H3", fontName="Arial-Bold", fontSize=10.5,
                              textColor=MID_BLUE, leading=14,
                              spaceBefore=10, spaceAfter=4)

    s["Bullet"] = ParagraphStyle("Bullet", **base, fontSize=10,
                                 leftIndent=16, bulletIndent=6,
                                 spaceAfter=3, textColor=BLACK)
    s["Numbered"] = ParagraphStyle("Numbered", **base, fontSize=10,
                                   leftIndent=20, bulletIndent=4,
                                   spaceAfter=3, textColor=BLACK)

    s["Code"] = ParagraphStyle("Code", fontName="Courier-TTF", fontSize=8.5,
                                leading=12, backColor=LIGHT_GRAY,
                                borderColor=MID_GRAY, borderWidth=0.5,
                                borderPad=6, leftIndent=8, rightIndent=8,
                                spaceAfter=8, textColor=colors.HexColor("#1a1a1a"))

    s["CoverTitle"] = ParagraphStyle("CoverTitle", fontName="Arial-Bold",
                                     fontSize=28, textColor=WHITE,
                                     leading=34, alignment=TA_CENTER,
                                     spaceAfter=12)
    s["CoverSub"]   = ParagraphStyle("CoverSub", fontName="Arial",
                                     fontSize=14, textColor=LIGHT_BLUE,
                                     leading=20, alignment=TA_CENTER,
                                     spaceAfter=8)
    s["CoverInfo"]  = ParagraphStyle("CoverInfo", fontName="Arial-Italic",
                                     fontSize=11, textColor=ACCENT_BLUE,
                                     leading=16, alignment=TA_CENTER)

    s["TOCEntry1"] = ParagraphStyle("TOCEntry1", fontName="Arial-Bold",
                                    fontSize=11, textColor=DARK_BLUE,
                                    leftIndent=0, spaceAfter=4, leading=14)
    s["TOCEntry2"] = ParagraphStyle("TOCEntry2", fontName="Arial",
                                    fontSize=10, textColor=BLACK,
                                    leftIndent=16, spaceAfter=2, leading=13)
    s["TOCHeading"] = ParagraphStyle("TOCHeading", fontName="Arial-Bold",
                                     fontSize=14, textColor=DARK_BLUE,
                                     spaceBefore=0, spaceAfter=12,
                                     leading=18)

    s["TableHeader"] = ParagraphStyle("TableHeader", fontName="Arial-Bold",
                                      fontSize=9, textColor=WHITE,
                                      leading=12, alignment=TA_CENTER)
    s["TableCell"]   = ParagraphStyle("TableCell", fontName="Arial",
                                      fontSize=9, textColor=BLACK,
                                      leading=12, alignment=TA_LEFT)
    s["TableCellC"]  = ParagraphStyle("TableCellC", fontName="Arial",
                                      fontSize=9, textColor=BLACK,
                                      leading=12, alignment=TA_CENTER)
    return s


# ── Table helpers ──────────────────────────────────────────────────────────────
def make_table(styles, headers, rows, col_widths, center_cols=None):
    """Build a styled table with alternating rows."""
    center_cols = center_cols or []
    th = styles["TableHeader"]
    tc = styles["TableCell"]
    tcc = styles["TableCellC"]

    def cell(text, center=False):
        return Paragraph(str(text), tcc if center else tc)

    header_row = [Paragraph(h, th) for h in headers]
    data = [header_row]
    for row in rows:
        data.append([cell(v, i in center_cols) for i, v in enumerate(row)])

    ts = TableStyle([
        ("BACKGROUND",  (0, 0), (-1, 0), DARK_BLUE),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, ROW_ALT]),
        ("GRID",        (0, 0), (-1, -1), 0.4, MID_GRAY),
        ("LINEBELOW",   (0, 0), (-1, 0), 1.2, DARK_BLUE),
        ("VALIGN",      (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING",  (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING",(0, 0), (-1, -1), 6),
    ])
    t = Table(data, colWidths=col_widths, repeatRows=1)
    t.setStyle(ts)
    return t


def h_rule(color=MID_BLUE, thickness=0.8):
    return HRFlowable(width="100%", thickness=thickness, color=color,
                      spaceAfter=6, spaceBefore=2)


# ── Page template with footer ──────────────────────────────────────────────────
class FooterDocTemplate(BaseDocTemplate):
    def __init__(self, filename, doc_name, **kwargs):
        super().__init__(filename, **kwargs)
        self.doc_name = doc_name
        self._page_count = 0

        frame = Frame(
            self.leftMargin, self.bottomMargin,
            self.width, self.height,
            id="main"
        )
        template = PageTemplate(id="main", frames=[frame],
                                onPage=self._draw_footer)
        self.addPageTemplates([template])

    def _draw_footer(self, canvas, doc):
        canvas.saveState()
        canvas.setFont("Arial", 8)
        canvas.setFillColor(DARK_GRAY)

        # Left: document name
        canvas.drawString(doc.leftMargin, 18 * mm, self.doc_name)

        # Centre: thin rule
        canvas.setStrokeColor(MID_BLUE)
        canvas.setLineWidth(0.5)
        canvas.line(doc.leftMargin, 20 * mm,
                    doc.leftMargin + doc.width, 20 * mm)

        # Right: page number
        page_num = f"Strona {canvas.getPageNumber()}"
        canvas.drawRightString(doc.leftMargin + doc.width, 18 * mm, page_num)

        canvas.restoreState()


# ── Cover page ─────────────────────────────────────────────────────────────────
def build_cover(styles, title, subtitle, extra_lines):
    """Return a list of flowables for a full-page cover."""
    story = []

    # Dark cover background rectangle drawn via a Table trick
    cover_data = [[""]]
    cover_table = Table(cover_data, colWidths=[PAGE_W - 4 * cm],
                        rowHeights=[PAGE_H - 6 * cm])
    cover_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), COVER_BG),
        ("BOX",        (0, 0), (-1, -1), 0, COVER_BG),
    ]))

    # We layer text on top by putting everything in one big table
    inner = []
    inner.append(Spacer(1, 3 * cm))
    inner.append(Paragraph(title, styles["CoverTitle"]))
    inner.append(Spacer(1, 0.4 * cm))
    inner.append(HRFlowable(width="60%", thickness=1.5,
                             color=ACCENT_BLUE, hAlign="CENTER",
                             spaceAfter=14, spaceBefore=4))
    inner.append(Paragraph(subtitle, styles["CoverSub"]))
    inner.append(Spacer(1, 0.8 * cm))
    for line in extra_lines:
        inner.append(Paragraph(line, styles["CoverInfo"]))
        inner.append(Spacer(1, 0.2 * cm))

    # Wrap inner in a table with dark background
    cell_table = Table([[inner]], colWidths=[PAGE_W - 4 * cm])
    cell_table.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), COVER_BG),
        ("VALIGN",        (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING",   (0, 0), (-1, -1), 30),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 30),
        ("TOPPADDING",    (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 60),
    ]))
    story.append(cell_table)
    story.append(PageBreak())
    return story


# ── TOC helper ─────────────────────────────────────────────────────────────────
class BookmarkTOC(TableOfContents):
    """TOC that writes PDF bookmarks as well."""
    pass


def toc_section(toc, styles, level, text):
    """Add an entry to the TOC and return a heading Paragraph."""
    style = styles["H1"] if level == 0 else styles["H2"] if level == 1 else styles["H3"]
    p = Paragraph(text, style)
    toc.addEntry(level, text, 0)   # pageNum filled in on 2nd pass
    return p


def heading(styles, level, text):
    s = styles["H1"] if level == 1 else styles["H2"] if level == 2 else styles["H3"]
    return Paragraph(text, s)


def para(styles, text, style="NormalJustify"):
    return Paragraph(text, styles[style])


def bullet(styles, items):
    return [Paragraph(f"• {item}", styles["Bullet"]) for item in items]


def numbered(styles, items, start=1):
    return [Paragraph(f"{i+start}. {item}", styles["Numbered"])
            for i, item in enumerate(items)]


def sp(n=1):
    return Spacer(1, n * 0.35 * cm)


# ══════════════════════════════════════════════════════════════════════════════
#  DOCUMENT 1 — BIZNESPLAN
# ══════════════════════════════════════════════════════════════════════════════
def build_biznesplan(output_path):
    S = build_styles()
    DOC_NAME = "Biznesplan — Platforma Komunikacyjna v1.0"

    doc = FooterDocTemplate(
        output_path,
        doc_name=DOC_NAME,
        pagesize=A4,
        leftMargin=2.5 * cm,
        rightMargin=2.5 * cm,
        topMargin=2.5 * cm,
        bottomMargin=2.8 * cm,
    )

    W = doc.width
    story = []

    # ── Cover ──────────────────────────────────────────────────────────────────
    story += build_cover(
        S,
        title="BIZNESPLAN\nPLATFORMA KOMUNIKACYJNA",
        subtitle="Wersja 1.0  |  Maj 2026",
        extra_lines=["Dokument poufny", "© 2026 Nexus Communications"],
    )

    # ── Table of Contents ──────────────────────────────────────────────────────
    story.append(Paragraph("Spis treści", S["TOCHeading"]))
    story.append(h_rule())
    story.append(sp())

    toc_entries = [
        (0, "1. Streszczenie wykonawcze"),
        (0, "2. Opis produktu"),
        (1, "2.1 Czym jest platforma"),
        (1, "2.2 Kluczowe funkcjonalności"),
        (1, "2.3 Modele dostępu"),
        (0, "3. Rynek docelowy"),
        (1, "3.1 Segmenty klientów"),
        (1, "3.2 Rozmiar rynku"),
        (0, "4. Model biznesowy"),
        (1, "4.1 Struktura cenowa"),
        (1, "4.2 Źródła przychodów"),
        (1, "4.3 Prognozy finansowe"),
        (0, "5. Strategia Go-To-Market"),
        (0, "6. Infrastruktura i operacje"),
        (1, "6.1 Model provisionowania"),
        (1, "6.2 Partnerzy infrastrukturalni"),
        (0, "7. Analiza konkurencji"),
        (0, "8. Ryzyka i mitigacja"),
        (0, "9. Podsumowanie"),
    ]
    for level, text in toc_entries:
        indent = level * 16
        style = ParagraphStyle(
            f"toc{level}", fontName="Arial-Bold" if level == 0 else "Arial",
            fontSize=10.5 if level == 0 else 9.5,
            textColor=DARK_BLUE if level == 0 else BLACK,
            leftIndent=indent, spaceAfter=3, leading=14
        )
        story.append(Paragraph(text, style))
    story.append(PageBreak())

    # ══════════════════════
    # 1. STRESZCZENIE
    # ══════════════════════
    story.append(heading(S, 1, " 1.  Streszczenie wykonawcze"))
    story.append(sp(0.5))
    story.append(para(S,
        "Platforma komunikacyjna SaaS umożliwiająca firmom i społecznościom "
        "uruchamianie własnych, izolowanych serwerów komunikacyjnych "
        "(czat tekstowy, głos, wideo, udostępnianie ekranu). "
        "Model biznesowy oparty na subskrypcji — klient wykupuje dedykowaną "
        "instancję serwerową automatycznie provisionowaną przez API."))
    story.append(sp())
    story.append(heading(S, 3, "Kluczowe przewagi"))
    story += bullet(S, [
        "Pełna izolacja danych klienta (dedykowany serwer per klient)",
        "Automatyczne provisionowanie — zero ręcznej pracy operacyjnej",
        "Funkcjonalność porównywalna z Discord przy własnej infrastrukturze",
        "Niski próg wejścia cenowego (~$4–5/mies. dla 10 użytkowników)",
    ])
    story.append(sp())

    # ══════════════════════
    # 2. OPIS PRODUKTU
    # ══════════════════════
    story.append(heading(S, 1, " 2.  Opis produktu"))
    story.append(sp(0.5))

    story.append(heading(S, 2, "2.1  Czym jest platforma"))
    story.append(para(S,
        "Platforma komunikacyjna to kompletne rozwiązanie dla firm, społeczności "
        "gamingowych, organizacji i zespołów, które chcą mieć własny, prywatny "
        "komunikator z pełną kontrolą nad danymi. W odróżnieniu od Discord czy "
        "Slack — dane klienta nigdy nie opuszczają jego dedykowanego serwera."))

    story.append(heading(S, 2, "2.2  Kluczowe funkcjonalności"))
    story += bullet(S, [
        "Czat tekstowy z kanałami, wątkami, reakcjami i ankietami",
        "Komunikacja głosowa i wideo (technologia WebRTC/LiveKit)",
        "Udostępnianie ekranu",
        "System ról i uprawnień",
        "Powiadomienia i wzmianki",
        "Wyszukiwanie wiadomości (indeks pełnotekstowy)",
        "Aplikacja desktopowa (Windows) z push-to-talk",
        "Panel administratora serwera",
        "Forum i kanały ogłoszeniowe",
    ])

    story.append(heading(S, 2, "2.3  Modele dostępu"))
    story += bullet(S, [
        "Przeglądarka internetowa (web app)",
        "Aplikacja desktopowa Windows (Electron)",
        "Planowane: aplikacja mobilna iOS/Android",
    ])
    story.append(sp())

    # ══════════════════════
    # 3. RYNEK DOCELOWY
    # ══════════════════════
    story.append(heading(S, 1, " 3.  Rynek docelowy"))
    story.append(sp(0.5))
    story.append(heading(S, 2, "3.1  Segmenty klientów"))

    segments = [
        ("Segment A — Społeczności gamingowe",
         "Grupy graczy szukające alternatywy dla Discord z własną infrastrukturą. "
         "Rozmiar: kilka–kilkaset osób. Motywacja: prywatność, brak reklam, własna kontrola."),
        ("Segment B — Małe i średnie firmy",
         "Zespoły 10–200 pracowników szukające bezpiecznej komunikacji wewnętrznej. "
         "Motywacja: RODO, bezpieczeństwo danych, brak vendor lock-in."),
        ("Segment C — Organizacje i stowarzyszenia",
         "Kluby sportowe, organizacje non-profit, uczelnie. "
         "Motywacja: własna platforma pod własną marką."),
        ("Segment D — Twórcy i streamerzy",
         "Budowanie społeczności wokół własnej marki. "
         "Motywacja: brak algorytmów, pełna własność społeczności."),
    ]
    for title_seg, desc in segments:
        story.append(heading(S, 3, title_seg))
        story.append(para(S, desc))
        story.append(sp(0.5))

    story.append(heading(S, 2, "3.2  Rozmiar rynku"))
    story += bullet(S, [
        "Globalny rynek komunikacji zespołowej (2025): ~$25 mld",
        "Segment self-hosted / prywatne instancje: rosnący trend po aferach prywatności",
        "Polska: ~2 mln aktywnych użytkowników Discord, ~500k firm MSP",
    ])
    story.append(sp())

    # ══════════════════════
    # 4. MODEL BIZNESOWY
    # ══════════════════════
    story.append(heading(S, 1, " 4.  Model biznesowy"))
    story.append(sp(0.5))
    story.append(heading(S, 2, "4.1  Struktura cenowa (subskrypcja miesięczna)"))
    story.append(sp(0.3))

    pricing_headers = ["Plan", "Użytkownicy", "Cena/mies.", "Koszt własny", "Marża"]
    pricing_rows = [
        ("Starter",    "10",    "$5",   "~$1.50", "~70%"),
        ("Standard",   "50",    "$15",  "~$5",    "~67%"),
        ("Pro",        "200",   "$40",  "~$15",   "~63%"),
        ("Enterprise", "500+",  "$100", "~$35",   "~65%"),
    ]
    pricing_widths = [W * 0.18, W * 0.18, W * 0.18, W * 0.22, W * 0.18]
    story.append(make_table(S, pricing_headers, pricing_rows, pricing_widths,
                            center_cols=[1, 2, 3, 4]))
    story.append(sp())

    story.append(heading(S, 2, "4.2  Źródła przychodów"))
    story += bullet(S, [
        "Subskrypcje miesięczne (główne źródło)",
        "Roczne plany z rabatem 15%",
        "Usługi migracji i konfiguracji (jednorazowe)",
        "Wsparcie techniczne premium (opcja)",
    ])

    story.append(heading(S, 2, "4.3  Prognozy finansowe"))
    fin_headers = ["Rok", "Cel subskrypcji", "Przychód", "Koszty", "Zysk"]
    fin_rows = [
        ("Rok 1", "100",   "~$14,400",  "~$3,600",  "~$10,800"),
        ("Rok 2", "500",   "~$72,000",  "~$18,000", "~$54,000"),
        ("Rok 3", "2 000", "~$288,000", "~$70,000", "~$218,000"),
    ]
    fin_widths = [W * 0.10, W * 0.22, W * 0.22, W * 0.22, W * 0.22]
    story.append(make_table(S, fin_headers, fin_rows, fin_widths,
                            center_cols=[1, 2, 3, 4]))
    story.append(sp())

    # ══════════════════════
    # 5. GO-TO-MARKET
    # ══════════════════════
    story.append(heading(S, 1, " 5.  Strategia Go-To-Market"))
    story.append(sp(0.5))
    story += bullet(S, [
        "Faza 1 (mies. 1–3): Beta z 20–50 społecznościami, zbieranie feedbacku, case studies",
        "Faza 2 (mies. 4–6): Publiczny launch, marketing w społecznościach gamingowych, program referralny",
        "Faza 3 (mies. 7–12): Kampanie B2B, partnerstwa z agencjami, content marketing",
    ])
    story.append(sp(0.5))
    story.append(para(S,
        "<b>Kanały dystrybucji:</b> strona produktowa, Microsoft Store, "
        "partnerzy resellerzy, direct sales."))
    story.append(sp())

    # ══════════════════════
    # 6. INFRASTRUKTURA
    # ══════════════════════
    story.append(heading(S, 1, " 6.  Infrastruktura i operacje"))
    story.append(sp(0.5))
    story.append(heading(S, 2, "6.1  Model provisionowania"))
    story.append(para(S,
        "Każdy klient po zakupie subskrypcji otrzymuje automatycznie:"))
    story += bullet(S, [
        "Dedykowany serwer VPS (2 vCPU, 4 GB RAM)",
        "Zainstalowany i skonfigurowany pełny stack aplikacyjny",
        "Własną domenę lub subdomenę",
        "Certyfikat SSL",
    ])
    story.append(para(S, "<b>Czas od zakupu do gotowego serwera: &lt; 3 minuty</b>"))
    story.append(sp(0.5))

    story.append(heading(S, 2, "6.2  Partnerzy infrastrukturalni"))
    story += bullet(S, [
        "Serwery VPS: OVH / Hetzner (negocjacje w toku)",
        "Przechowywanie plików: Cloudflare R2",
        "Frontend: Vercel (CDN globalny)",
        "Voice/Video: LiveKit (self-hosted na serwerach klientów)",
    ])
    story.append(sp())

    # ══════════════════════
    # 7. KONKURENCJA
    # ══════════════════════
    story.append(heading(S, 1, " 7.  Analiza konkurencji"))
    story.append(sp(0.5))
    comp_headers = ["Konkurent", "Cena", "Własna infrastr.", "Głos/Wideo", "Słabości"]
    comp_rows = [
        ("Discord",          "Darmowy/$10",   "Nie", "Tak",         "Brak prywatności, reklamy"),
        ("Slack",            "$7–13/user",    "Nie", "Ograniczony", "Drogi, zamknięty"),
        ("Rocket.Chat",      "$4/user",       "Tak", "Słaby",       "Skomplikowana instalacja"),
        ("Matrix/Element",   "Darmowy",       "Tak", "Tak",         "Trudny w konfiguracji"),
        ("Nasza platforma",  "$5–100/serwer", "Tak", "Tak",         "Nowa marka"),
    ]
    comp_widths = [W * 0.18, W * 0.17, W * 0.18, W * 0.14, W * 0.30]
    story.append(make_table(S, comp_headers, comp_rows, comp_widths,
                            center_cols=[1, 2, 3]))
    story.append(sp())

    # ══════════════════════
    # 8. RYZYKA
    # ══════════════════════
    story.append(heading(S, 1, " 8.  Ryzyka i mitigacja"))
    story.append(sp(0.5))
    risk_headers = ["Ryzyko", "Prawdopodobieństwo", "Mitigacja"]
    risk_rows = [
        ("Dominacja Discord",          "Wysokie", "Fokus na prywatność i B2B"),
        ("Problemy techniczne",         "Średnie", "Automatyczny monitoring i failover"),
        ("Zmiana cen VPS",              "Niskie",  "Umowy długoterminowe, multi-vendor"),
        ("Naruszenie bezpieczeństwa",   "Niskie",  "Izolacja per klient, audyty"),
    ]
    risk_widths = [W * 0.32, W * 0.22, W * 0.44]
    story.append(make_table(S, risk_headers, risk_rows, risk_widths,
                            center_cols=[1]))
    story.append(sp())

    # ══════════════════════
    # 9. PODSUMOWANIE
    # ══════════════════════
    story.append(heading(S, 1, " 9.  Podsumowanie"))
    story.append(sp(0.5))
    story.append(para(S,
        "Platforma adresuje rosnące zapotrzebowanie na prywatne rozwiązania "
        "komunikacyjne. Automatyzacja provisionowania eliminuje koszty operacyjne "
        "i umożliwia skalowanie bez proporcjonalnego wzrostu zatrudnienia. "
        "Model subskrypcyjny zapewnia przewidywalne przychody przy wysokich "
        "marżach (60–70%)."))
    story.append(sp())
    story.append(h_rule(DARK_BLUE, 1.2))
    story.append(para(S,
        "<i>Dokument poufny. Wszelkie prawa zastrzeżone. © 2026 Nexus Communications.</i>",
        "Small"))

    doc.multiBuild(story)
    print(f"  [OK] {output_path}")


# ══════════════════════════════════════════════════════════════════════════════
#  DOCUMENT 2 — DOKUMENTACJA TECHNICZNA
# ══════════════════════════════════════════════════════════════════════════════
def build_dokumentacja(output_path):
    S = build_styles()
    DOC_NAME = "Dokumentacja Techniczna — Platforma Komunikacyjna v1.0"

    doc = FooterDocTemplate(
        output_path,
        doc_name=DOC_NAME,
        pagesize=A4,
        leftMargin=2.5 * cm,
        rightMargin=2.5 * cm,
        topMargin=2.5 * cm,
        bottomMargin=2.8 * cm,
    )
    W = doc.width
    story = []

    # ── Cover ──────────────────────────────────────────────────────────────────
    story += build_cover(
        S,
        title="DOKUMENTACJA TECHNICZNA\nPLATFORMA KOMUNIKACYJNA",
        subtitle="Wersja 1.0  |  Maj 2026",
        extra_lines=["Specyfikacja architektury i API", "© 2026 Nexus Communications"],
    )

    # ── TOC ────────────────────────────────────────────────────────────────────
    story.append(Paragraph("Spis treści", S["TOCHeading"]))
    story.append(h_rule())
    story.append(sp())

    toc_entries = [
        (0, "1. Architektura systemu"),
        (1, "1.1 Przegląd architektury"),
        (0, "2. Stack technologiczny"),
        (1, "2.1 Frontend"),
        (1, "2.2 Backend"),
        (1, "2.3 Infrastruktura"),
        (1, "2.4 Aplikacja desktopowa"),
        (0, "3. Schemat bazy danych"),
        (1, "3.1 Główne tabele"),
        (1, "3.2 Indeksy wydajnościowe"),
        (0, "4. API REST — Endpointy"),
        (1, "4.1 Autentykacja"),
        (1, "4.2 Serwery i kanały"),
        (1, "4.3 Wiadomości"),
        (1, "4.4 Głos"),
        (0, "5. Komunikacja real-time (Socket.IO)"),
        (1, "5.1 Zdarzenia klient do serwer"),
        (1, "5.2 Zdarzenia serwer do klient"),
        (0, "6. Wymagania serwerowe"),
        (1, "6.1 Minimalna specyfikacja"),
        (1, "6.2 Zużycie zasobów"),
        (1, "6.3 Rekomendowane serwery VPS"),
        (0, "7. Provisioning — flow automatyczny"),
        (1, "7.1 Schemat procesu"),
        (1, "7.2 Docker Compose"),
        (0, "8. Bezpieczeństwo"),
        (0, "9. Skalowanie"),
        (0, "10. Monitoring i dostępność"),
    ]
    for level, text in toc_entries:
        indent = level * 16
        style = ParagraphStyle(
            f"toc{level}t", fontName="Arial-Bold" if level == 0 else "Arial",
            fontSize=10.5 if level == 0 else 9.5,
            textColor=DARK_BLUE if level == 0 else BLACK,
            leftIndent=indent, spaceAfter=3, leading=14
        )
        story.append(Paragraph(text, style))
    story.append(PageBreak())

    # ══════════════════════
    # 1. ARCHITEKTURA
    # ══════════════════════
    story.append(heading(S, 1, " 1.  Architektura systemu"))
    story.append(sp(0.5))
    story.append(heading(S, 2, "1.1  Przegląd architektury"))
    story.append(para(S, "System składa się z dwóch warstw:"))
    story.append(sp(0.3))

    story.append(heading(S, 3, "Warstwa zarządzania (operator platformy)"))
    story += bullet(S, [
        "Panel administracyjny do zarządzania klientami i subskrypcjami",
        "System billing i płatności",
        "API provisionowania (automatyczne tworzenie serwerów klientów)",
        "Frontend aplikacji (Vercel CDN — współdzielony)",
    ])
    story.append(heading(S, 3, "Warstwa klienta (dedykowana per klient)"))
    story += bullet(S, [
        "Serwer VPS z pełnym stackiem aplikacyjnym",
        "Izolowana baza danych MySQL",
        "Serwer głosowy LiveKit SFU",
        "Serwer TURN (coturn) dla NAT traversal",
    ])
    story.append(sp())

    # ══════════════════════
    # 2. STACK
    # ══════════════════════
    story.append(heading(S, 1, " 2.  Stack technologiczny"))
    story.append(sp(0.5))

    story.append(heading(S, 2, "2.1  Frontend"))
    fe_h = ["Technologia", "Wersja", "Zastosowanie"]
    fe_r = [
        ("Next.js",           "14.2",    "Framework React, SSR/SSG"),
        ("TypeScript",        "5.x",     "Typowanie statyczne"),
        ("Tailwind CSS",      "3.x",     "Stylowanie"),
        ("Zustand",           "4.5",     "Zarządzanie stanem"),
        ("Socket.IO Client",  "4.7",     "WebSocket komunikacja"),
        ("LiveKit Client SDK","2.5",     "Głos i wideo"),
    ]
    story.append(make_table(S, fe_h, fe_r,
                            [W*0.30, W*0.15, W*0.52], center_cols=[1]))
    story.append(sp(0.5))

    story.append(heading(S, 2, "2.2  Backend"))
    be_h = ["Technologia", "Wersja", "Zastosowanie"]
    be_r = [
        ("Node.js",              "20 LTS", "Środowisko uruchomieniowe"),
        ("Express",              "4.x",    "HTTP API REST"),
        ("TypeScript",           "5.x",    "Typowanie statyczne"),
        ("Socket.IO",            "4.7",    "Real-time WebSocket"),
        ("MySQL2",               "3.x",    "Sterownik bazy danych"),
        ("LiveKit Server SDK",   "2.x",    "Zarządzanie pokojami głosowymi"),
        ("JWT",                  "9.x",    "Autentykacja tokenowa"),
        ("bcrypt",               "5.x",    "Hashowanie haseł"),
        ("multer",               "1.x",    "Upload plików"),
    ]
    story.append(make_table(S, be_h, be_r,
                            [W*0.30, W*0.15, W*0.52], center_cols=[1]))
    story.append(sp(0.5))

    story.append(heading(S, 2, "2.3  Infrastruktura"))
    inf_h = ["Technologia", "Zastosowanie"]
    inf_r = [
        ("MySQL 8.0",          "Relacyjna baza danych"),
        ("LiveKit SFU",        "Selective Forwarding Unit (głos/wideo)"),
        ("coturn",             "Serwer TURN/STUN dla NAT traversal"),
        ("Docker + Compose",   "Konteneryzacja całego stacku"),
        ("nginx",              "Reverse proxy, SSL termination"),
        ("Let's Encrypt",      "Certyfikaty SSL"),
    ]
    story.append(make_table(S, inf_h, inf_r, [W*0.30, W*0.67]))
    story.append(sp(0.5))

    story.append(heading(S, 2, "2.4  Aplikacja desktopowa"))
    desk_h = ["Technologia", "Zastosowanie"]
    desk_r = [
        ("Electron 31",        "Wrapper desktopowy"),
        ("electron-updater",   "Automatyczne aktualizacje"),
        ("uiohook-napi",       "Globalne skróty klawiszowe (PTT)"),
        ("electron-builder",   "Budowanie instalatora NSIS"),
    ]
    story.append(make_table(S, desk_h, desk_r, [W*0.30, W*0.67]))
    story.append(sp())

    # ══════════════════════
    # 3. BAZA DANYCH
    # ══════════════════════
    story.append(heading(S, 1, " 3.  Schemat bazy danych"))
    story.append(sp(0.5))
    story.append(heading(S, 2, "3.1  Główne tabele"))
    story += bullet(S, [
        "users — konta użytkowników, autentykacja, profile",
        "servers — serwery komunikacyjne (plany: free/standard/pro)",
        "server_members — członkostwo użytkowników w serwerach",
        "roles — role z systemem uprawnień (JSON)",
        "channels — kanały (text/voice/announcement/forum/stage)",
        "messages — wiadomości z obsługą wątków i odpowiedzi",
        "reactions — reakcje emoji na wiadomości",
        "polls/poll_options/poll_votes — system ankiet",
        "message_attachments — załączniki (pliki, obrazy)",
        "notifications — powiadomienia (wzmianki, odpowiedzi, reakcje)",
        "voice_states — aktualny stan użytkowników na kanałach głosowych",
    ])
    story.append(sp(0.5))
    story.append(heading(S, 2, "3.2  Indeksy wydajnościowe"))
    story += bullet(S, [
        "idx_channel_created (channel_id, created_at DESC) — stronicowanie wiadomości",
        "idx_reactions_msg (message_id) — szybkie pobieranie reakcji",
        "ft_messages_content (FULLTEXT) — wyszukiwanie pełnotekstowe",
        "idx_polls_message (message_id) — pobieranie ankiet",
        "idx_user_unread (user_id, read_at) — licznik nieprzeczytanych",
    ])
    story.append(sp())

    # ══════════════════════
    # 4. API
    # ══════════════════════
    story.append(heading(S, 1, " 4.  API REST — Endpointy"))
    story.append(sp(0.5))

    def api_table(headers, rows):
        return make_table(S, headers, rows,
                          [W*0.12, W*0.40, W*0.45], center_cols=[0])

    story.append(heading(S, 2, "4.1  Autentykacja"))
    story.append(api_table(
        ["Metoda", "Endpoint", "Opis"],
        [
            ("POST", "/api/auth/register", "Rejestracja użytkownika"),
            ("POST", "/api/auth/login",    "Logowanie, zwraca JWT"),
            ("GET",  "/api/auth/me",       "Dane zalogowanego użytkownika"),
        ]
    ))
    story.append(sp(0.5))

    story.append(heading(S, 2, "4.2  Serwery i kanały"))
    story.append(api_table(
        ["Metoda", "Endpoint", "Opis"],
        [
            ("GET",  "/api/servers",                   "Lista serwerów użytkownika"),
            ("POST", "/api/servers",                   "Utwórz nowy serwer"),
            ("GET",  "/api/servers/:id",               "Szczegóły serwera"),
            ("GET",  "/api/servers/:id/channels",      "Lista kanałów"),
            ("POST", "/api/servers/:id/channels",      "Utwórz kanał"),
        ]
    ))
    story.append(sp(0.5))

    story.append(heading(S, 2, "4.3  Wiadomości"))
    story.append(api_table(
        ["Metoda", "Endpoint", "Opis"],
        [
            ("GET",    "/api/channels/:id/messages",           "Pobierz wiadomości (paginacja kursorowa)"),
            ("POST",   "/api/channels/:id/messages",           "Wyślij wiadomość (HTTP fallback)"),
            ("PATCH",  "/api/channels/:id/messages/:msgId",    "Edytuj wiadomość"),
            ("DELETE", "/api/channels/:id/messages/:msgId",    "Usuń wiadomość"),
            ("GET",    "/api/servers/:id/search",              "Wyszukiwanie FULLTEXT"),
        ]
    ))
    story.append(sp(0.5))

    story.append(heading(S, 2, "4.4  Głos"))
    story.append(api_table(
        ["Metoda", "Endpoint", "Opis"],
        [
            ("GET",    "/api/livekit/token", "Token dostępu do kanału głosowego"),
            ("DELETE", "/api/livekit/kick",  "Wyrzucenie użytkownika z głosu"),
        ]
    ))
    story.append(sp())

    # ══════════════════════
    # 5. SOCKET.IO
    # ══════════════════════
    story.append(heading(S, 1, " 5.  Komunikacja real-time (Socket.IO)"))
    story.append(sp(0.5))

    story.append(heading(S, 2, "5.1  Zdarzenia klient → serwer"))
    sock_h1 = ["Zdarzenie", "Dane", "Opis"]
    sock_r1 = [
        ("join_server",    "serverId",                        "Dołącz do pokoju serwera"),
        ("join_channel",   "channelId",                       "Dołącz do pokoju kanału"),
        ("MESSAGE_CREATE", "channelId, content, nonce",       "Wyślij wiadomość"),
        ("MESSAGE_UPDATE", "messageId, channelId, content",   "Edytuj wiadomość"),
        ("MESSAGE_DELETE", "messageId, channelId",            "Usuń wiadomość"),
        ("REACTION_ADD",   "messageId, channelId, emoji",     "Dodaj reakcję"),
        ("TYPING_START",   "channelId",                       "Wskaźnik pisania"),
    ]
    story.append(make_table(S, sock_h1, sock_r1,
                            [W*0.26, W*0.36, W*0.35]))
    story.append(sp(0.5))

    story.append(heading(S, 2, "5.2  Zdarzenia serwer → klient"))
    sock_h2 = ["Zdarzenie", "Opis"]
    sock_r2 = [
        ("MESSAGE_CREATE",   "Nowa wiadomość od innego użytkownika"),
        ("MESSAGE_UPDATE",   "Edycja wiadomości"),
        ("MESSAGE_DELETE",   "Usunięcie wiadomości (natychmiastowe)"),
        ("REACTION_UPDATE",  "Aktualizacja reakcji"),
        ("PRESENCE_UPDATE",  "Zmiana statusu użytkownika"),
        ("NOTIFICATION",     "Nowe powiadomienie (wzmianka/odpowiedź)"),
        ("TYPING_START/STOP","Wskaźnik pisania"),
    ]
    story.append(make_table(S, sock_h2, sock_r2, [W*0.30, W*0.67]))
    story.append(sp())

    # ══════════════════════
    # 6. WYMAGANIA SERWEROWE
    # ══════════════════════
    story.append(heading(S, 1, " 6.  Wymagania serwerowe"))
    story.append(sp(0.5))

    story.append(heading(S, 2, "6.1  Minimalna specyfikacja per klient (10 użytkowników)"))
    spec_h = ["Zasób", "Minimum", "Zalecane"]
    spec_r = [
        ("vCPU",          "2 rdzenie", "2 rdzenie"),
        ("RAM",           "2 GB",      "4 GB"),
        ("Dysk SSD",      "20 GB",     "40 GB"),
        ("Transfer",      "1 TB/mies.","Unmetered"),
        ("Port sieciowy", "100 Mbps",  "1 Gbps"),
    ]
    story.append(make_table(S, spec_h, spec_r,
                            [W*0.34, W*0.30, W*0.33],
                            center_cols=[1, 2]))
    story.append(sp(0.5))

    story.append(heading(S, 2, "6.2  Zużycie zasobów per komponent"))
    res_h = ["Komponent", "RAM", "CPU idle", "CPU peak"]
    res_r = [
        ("Node.js + Socket.IO", "150–256 MB",  "2%",  "15%"),
        ("MySQL 8.0",           "256–512 MB",  "1%",  "20%"),
        ("LiveKit SFU",         "400–512 MB",  "3%",  "60%"),
        ("coturn",              "64 MB",       "~0%", "5%"),
        ("System OS",           "256 MB",      "2%",  "—"),
    ]
    story.append(make_table(S, res_h, res_r,
                            [W*0.36, W*0.22, W*0.20, W*0.19],
                            center_cols=[1, 2, 3]))
    story.append(sp(0.5))

    story.append(heading(S, 2, "6.3  Rekomendowane serwery VPS"))
    vps_h = ["Dostawca", "Model", "vCPU", "RAM", "Cena"]
    vps_r = [
        ("Hetzner", "CAX11 ARM", "2", "4 GB", "3.79 EUR/mies."),
        ("Hetzner", "CX22",      "2", "4 GB", "4.51 EUR/mies."),
        ("OVH",     "Starter-1", "1", "2 GB", "3.50 EUR/mies."),
    ]
    story.append(make_table(S, vps_h, vps_r,
                            [W*0.20, W*0.22, W*0.12, W*0.14, W*0.29],
                            center_cols=[1, 2, 3]))
    story.append(sp())

    # ══════════════════════
    # 7. PROVISIONING
    # ══════════════════════
    story.append(heading(S, 1, " 7.  Provisioning — flow automatyczny"))
    story.append(sp(0.5))
    story.append(heading(S, 2, "7.1  Schemat procesu"))
    story += numbered(S, [
        "Klient kupuje plan",
        "System billing potwierdza płatność",
        "Provisioning API — POST /v1/servers (Hetzner/OVH API)",
        "Oczekiwanie na status running (~20–60 sek.)",
        "SSH — wykonanie skryptu instalacyjnego",
        "docker-compose up (Node.js + MySQL + LiveKit + coturn)",
        "Konfiguracja nginx + SSL (Let's Encrypt)",
        "Inicjalizacja bazy danych (schema.sql)",
        "Wysłanie danych dostępowych do klienta",
        "Serwer gotowy (~3 minuty od zakupu)",
    ])
    story.append(sp(0.5))

    story.append(heading(S, 2, "7.2  Docker Compose (struktura)"))
    story.append(para(S,
        "Każda instancja klienta uruchamiana przez <b>docker-compose.yml</b> "
        "z 4 serwisami: backend, db, livekit, coturn. "
        "Reverse proxy nginx obsługuje SSL i routing do backendu."))
    story.append(sp(0.3))

    docker_code = (
        "services:\n"
        "  backend:\n"
        "    image: nexus-backend:latest\n"
        "    ports: [\"3001:3001\"]\n"
        "    environment:\n"
        "      - DB_HOST=db\n"
        "      - LIVEKIT_URL=ws://livekit:7880\n"
        "  db:\n"
        "    image: mysql:8.0\n"
        "    volumes: [db_data:/var/lib/mysql]\n"
        "  livekit:\n"
        "    image: livekit/livekit-server\n"
        "    ports: [\"7880:7880\", \"7881:7881/udp\"]\n"
        "  coturn:\n"
        "    image: coturn/coturn\n"
        "    ports: [\"3478:3478/udp\"]"
    )
    story.append(Paragraph(docker_code.replace("\n", "<br/>").replace(" ", "&nbsp;"),
                           S["Code"]))
    story.append(sp())

    # ══════════════════════
    # 8. BEZPIECZEŃSTWO
    # ══════════════════════
    story.append(heading(S, 1, " 8.  Bezpieczeństwo"))
    story.append(sp(0.5))

    sec_sections = [
        ("8.1  Autentykacja", [
            "JWT (JSON Web Tokens) z czasem wygaśnięcia",
            "bcrypt dla hashowania haseł (salt rounds: 12)",
            "Tokeny socket weryfikowane przy połączeniu",
        ]),
        ("8.2  Autoryzacja", [
            "System ról z granularnym systemem uprawnień (JSON)",
            "Weryfikacja uprawnień per endpoint",
            "Moderacja: mute, ban, kick z logowaniem",
        ]),
        ("8.3  Szyfrowanie komunikacji", [
            "HTTPS/WSS (TLS 1.2+) dla wszystkich połączeń HTTP i WebSocket",
            "DTLS-SRTP dla strumieni audio/wideo (LiveKit)",
            "Certyfikaty Let's Encrypt (auto-renewal)",
        ]),
        ("8.4  Izolacja danych", [
            "Każdy klient = osobny serwer VPS = osobna baza danych",
            "Brak dostępu cross-tenant",
            "Dane nie opuszczają serwera klienta (poza frontendem)",
        ]),
        ("8.5  Ochrona przed atakami", [
            "Rate limiting na endpointach API",
            "Walidacja typów i rozmiarów uploadowanych plików",
            "Sanityzacja danych wejściowych",
            "DDoS protection przez dostawcę VPS",
        ]),
    ]
    for title_sec, items in sec_sections:
        story.append(heading(S, 2, title_sec))
        story += bullet(S, items)
        story.append(sp(0.3))
    story.append(sp())

    # ══════════════════════
    # 9. SKALOWANIE
    # ══════════════════════
    story.append(heading(S, 1, " 9.  Skalowanie"))
    story.append(sp(0.5))
    story.append(heading(S, 2, "9.1  Skalowanie poziome"))
    story.append(para(S, "Przy wzroście liczby użytkowników:"))
    story += bullet(S, [
        "Dodanie Redis jako adaptera Socket.IO",
        "Load balancer (nginx upstream)",
        "MySQL connection pooling",
    ])
    story.append(sp(0.3))
    story.append(heading(S, 2, "9.2  Storage plików"))
    story += bullet(S, [
        "Aktualne: pliki w MySQL (MEDIUMBLOB) — wystarczające do ~100 GB",
        "Planowane: migracja do Cloudflare R2 (object storage, darmowy egress)",
    ])
    story.append(sp(0.3))
    story.append(heading(S, 2, "9.3  Progi skalowania"))
    scale_h = ["Użytkownicy", "Zalecana akcja"]
    scale_r = [
        ("10",   "CX22/CAX11 — standard"),
        ("50",   "CX32 (4 vCPU, 8 GB RAM)"),
        ("200",  "CX52 (8 vCPU, 16 GB RAM)"),
        ("500+", "Dedykowany serwer + Redis"),
    ]
    story.append(make_table(S, scale_h, scale_r,
                            [W*0.22, W*0.75], center_cols=[0]))
    story.append(sp())

    # ══════════════════════
    # 10. MONITORING
    # ══════════════════════
    story.append(heading(S, 1, " 10.  Monitoring i dostępność"))
    story.append(sp(0.5))
    story.append(heading(S, 2, "10.1  Metryki do monitorowania"))
    story += bullet(S, [
        "Użycie CPU i RAM (próg alertu: >80%)",
        "Liczba aktywnych połączeń WebSocket",
        "Rozmiar bazy danych",
        "Czas odpowiedzi API (p95 < 200 ms)",
        "Dostępność portu głosowego UDP",
    ])
    story.append(sp(0.3))
    story.append(heading(S, 2, "10.2  SLA"))
    story += bullet(S, [
        "Cel dostępności: 99.9% (< 9 godzin przestoju rocznie)",
        "Backup bazy danych: co 24 godziny, retencja 7 dni",
        "Czas przywrócenia po awarii (RTO): < 2 godziny",
    ])
    story.append(sp())
    story.append(h_rule(DARK_BLUE, 1.2))
    story.append(para(S,
        "<i>Dokumentacja techniczna. Wszelkie prawa zastrzeżone. "
        "© 2026 Nexus Communications.</i>",
        "Small"))

    doc.multiBuild(story)
    print(f"  [OK] {output_path}")


# ── Entry point ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    out_dir = r"C:\Users\ahsru\Desktop\projekt Z\docs"
    os.makedirs(out_dir, exist_ok=True)

    print("Generating PDFs …")
    build_biznesplan(os.path.join(out_dir, "Biznesplan_Platforma_Komunikacyjna.pdf"))
    build_dokumentacja(os.path.join(out_dir, "Dokumentacja_Techniczna.pdf"))
    print("Done.")
