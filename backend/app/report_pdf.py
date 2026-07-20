"""Render the ranked report as a professional, branded PDF.

Kept isolated from report.py so the (optional) reportlab dependency is only
imported when a PDF is actually requested. The PDF is a faithful paper version
of GET /api/report plus the frozen student profile — same deterministic figures,
nothing generated here.
"""
from __future__ import annotations

import io
from datetime import datetime, timezone

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    HRFlowable,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

BRAND = colors.HexColor("#4f46e5")
BRAND_DARK = colors.HexColor("#312e81")
INK = colors.HexColor("#111827")
MUTED = colors.HexColor("#6b7280")
LINE = colors.HexColor("#e5e7eb")
SOFT = colors.HexColor("#f3f4f6")
SUCCESS = colors.HexColor("#047857")
DANGER = colors.HexColor("#b91c1c")
WARNING = colors.HexColor("#b45309")

SEVERITY_COLOR = {"high": DANGER, "medium": WARNING, "low": MUTED}


def _styles():
    ss = getSampleStyleSheet()
    ss.add(ParagraphStyle("H1", parent=ss["Title"], fontSize=20, textColor=INK, spaceAfter=2, leading=24))
    ss.add(ParagraphStyle("Sub", fontSize=9, textColor=MUTED, spaceAfter=2))
    ss.add(ParagraphStyle("H2", fontSize=12, textColor=BRAND_DARK, spaceBefore=14, spaceAfter=6, leading=15, fontName="Helvetica-Bold"))
    ss.add(ParagraphStyle("Body", parent=ss["Normal"], fontSize=9.5, textColor=INK, leading=14))
    ss.add(ParagraphStyle("Small", fontSize=8, textColor=MUTED, leading=11))
    ss.add(ParagraphStyle("Cell", fontSize=9, textColor=INK, leading=12))
    ss.add(ParagraphStyle("CellR", fontSize=9, textColor=INK, leading=12, alignment=2))
    ss.add(ParagraphStyle("CellHead", fontSize=8, textColor=colors.white, leading=11, fontName="Helvetica-Bold"))
    ss.add(ParagraphStyle("Reco", fontSize=10, textColor=INK, leading=15))
    return ss


def _fmt(sym: str, n: float) -> str:
    return f"{sym}{round(n):,}"


def _safe(text: str) -> str:
    """Swap glyphs missing from reportlab's base Helvetica for ASCII equivalents."""
    return (text or "").replace("≈", "~").replace("→", "->").replace("—", "-")


def _profile_rows(profile: dict) -> list[list]:
    q = profile.get("last_qualification") or {}
    e = profile.get("english_test") or {}
    t = profile.get("target") or {}
    b = profile.get("budget") or {}
    pairs = [
        ("Name", profile.get("full_name")),
        ("Home city", profile.get("home_city")),
        ("Qualification", ", ".join(str(x) for x in [q.get("level"), q.get("grades")] if x)),
        ("English test", ", ".join(str(x) for x in [e.get("status"), e.get("overall_score")] if x not in (None, ""))),
        ("Course", t.get("course")),
        ("Destination", t.get("country")),
        ("Intake", t.get("intake")),
        ("Preferred", ", ".join(t.get("preferred_universities") or [])),
        ("Budget / year", f"{b.get('currency', '')} {b.get('ceiling_per_year'):,}".strip() if b.get("ceiling_per_year") else None),
        ("Sponsor", b.get("sponsor")),
    ]
    return [[k, str(v)] for k, v in pairs if v]


def build_report_pdf(report: dict, profile: dict | None) -> bytes:
    ss = _styles()
    cur = report["currency"]
    sym, sec, rate = cur["symbol"], cur["secondary"], cur["rate"]
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=18 * mm, rightMargin=18 * mm, topMargin=16 * mm, bottomMargin=16 * mm,
        title="The Negotiator — Fee Negotiation Report",
    )
    story: list = []
    now = datetime.now(timezone.utc).strftime("%d %b %Y, %H:%M UTC")

    # ---- header ----
    story.append(Paragraph("The Negotiator", ss["H1"]))
    story.append(Paragraph(f"Study-abroad fee negotiation report &middot; {report['vertical']}", ss["Sub"]))
    story.append(Paragraph(f"Generated {now}", ss["Small"]))
    story.append(Spacer(1, 4))
    story.append(HRFlowable(width="100%", thickness=1.4, color=BRAND, spaceAfter=6))

    # ---- student info ----
    if profile:
        story.append(Paragraph("Student profile", ss["H2"]))
        rows = _profile_rows(profile)
        data = [[Paragraph(f"<b>{k}</b>", ss["Cell"]), Paragraph(v, ss["Cell"])] for k, v in rows]
        if data:
            tbl = Table(data, colWidths=[35 * mm, 139 * mm])
            tbl.setStyle(TableStyle([
                ("LINEBELOW", (0, 0), (-1, -2), 0.4, LINE),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ]))
            story.append(tbl)

    # ---- recommendation ----
    story.append(Paragraph("Recommendation", ss["H2"]))
    reco = Table([[Paragraph(_safe(report["recommendation"]), ss["Reco"])]], colWidths=[174 * mm])
    reco.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#eef2ff")),
        ("BOX", (0, 0), (-1, -1), 0.6, BRAND),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(reco)

    ranked = report["ranked"]

    # ---- rankings summary table ----
    if ranked:
        story.append(Paragraph("Consultancy rankings", ss["H2"]))
        head = [Paragraph(h, ss["CellHead"]) for h in ["#", "Consultancy", f"Charges ({cur['quote_currency']})", f"({sec})", "Saved", "Flags"]]
        body = [head]
        for e in ranked:
            body.append([
                Paragraph(str(e.get("rank", "")), ss["Cell"]),
                Paragraph(e["consultancy_name"], ss["Cell"]),
                Paragraph(_fmt(sym, e["consultancy_total"]), ss["CellR"]),
                Paragraph(f"{sec} {round(e['consultancy_total_secondary']):,}", ss["CellR"]),
                Paragraph(_fmt(sym, e["savings"]) if e.get("savings") else "—", ss["CellR"]),
                Paragraph(str(len(e["red_flags"])) if e["red_flags"] else "—", ss["CellR"]),
            ])
        tbl = Table(body, colWidths=[9 * mm, 62 * mm, 35 * mm, 34 * mm, 20 * mm, 14 * mm], repeatRows=1)
        tbl.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), BRAND),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, SOFT]),
            ("LINEBELOW", (0, 0), (-1, -1), 0.4, LINE),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ]))
        story.append(tbl)

        # highlight the winner
        top = ranked[0]
        story.append(Spacer(1, 4))
        story.append(Paragraph(
            f"<b>Best value:</b> {top['consultancy_name']} at {_fmt(sym, top['consultancy_total'])} "
            f"(≈ {sec} {round(top['consultancy_total_secondary']):,}).", ss["Small"]))

    # ---- itemised detail per consultancy ----
    for e in ranked:
        story.append(Paragraph(
            f"#{e.get('rank', '')} &middot; {e['consultancy_name']}"
            + (f" ({e['persona_id'].replace('_', ' ')})" if e.get("persona_id") else ""),
            ss["H2"]))
        head = [Paragraph(h, ss["CellHead"]) for h in ["Item", "University / note", cur["quote_currency"], sec]]
        body = [head]
        for q in e.get("items", []):
            label = q["item"].replace("_", " ").title()
            where = " — ".join(str(x) for x in [q.get("university"), q.get("note")] if x) or "—"
            amt = _fmt(sym, q["amount"])
            if q.get("is_revised") and q.get("revised_from") is not None:
                amt = f'<strike>{_fmt(sym, q["revised_from"])}</strike> {_fmt(sym, q["amount"])}'
            body.append([
                Paragraph(label, ss["Cell"]),
                Paragraph(where, ss["Cell"]),
                Paragraph(amt, ss["CellR"]),
                Paragraph(f"{sec} {round(q['amount'] * rate):,}", ss["CellR"]),
            ])
        body.append([
            Paragraph("<b>Consultancy charges</b> (excl. deposits)", ss["Cell"]), Paragraph("", ss["Cell"]),
            Paragraph(f"<b>{_fmt(sym, e['consultancy_total'])}</b>", ss["CellR"]),
            Paragraph(f"<b>{sec} {round(e['consultancy_total_secondary']):,}</b>", ss["CellR"]),
        ])
        tbl = Table(body, colWidths=[38 * mm, 74 * mm, 31 * mm, 31 * mm], repeatRows=1)
        tbl.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), BRAND_DARK),
            ("LINEBELOW", (0, 0), (-1, -1), 0.4, LINE),
            ("LINEABOVE", (0, -1), (-1, -1), 0.6, INK),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ]))
        story.append(tbl)

        for f in e["red_flags"]:
            c = SEVERITY_COLOR.get(f["severity"], MUTED)
            story.append(Paragraph(
                f'<font color="{c.hexval()[2:]}"><b>&#9873; {f["severity"].upper()}</b></font> '
                f'{f["description"]}. <font color="#6b7280">{f.get("detail") or ""}</font>',
                ss["Small"]))
        story.append(Spacer(1, 6))

    # ---- other outcomes ----
    if report.get("others"):
        story.append(Paragraph("Calls without a comparable quote", ss["H2"]))
        for e in report["others"]:
            outcome = (e.get("outcome") or "in progress").replace("_", " ")
            detail = f" — {e['outcome_detail']}" if e.get("outcome_detail") else ""
            story.append(Paragraph(f"<b>{e['consultancy_name']}</b> — {outcome}{detail}", ss["Small"]))

    # ---- footer ----
    story.append(Spacer(1, 10))
    story.append(HRFlowable(width="100%", thickness=0.6, color=LINE, spaceAfter=4))
    fx = f"FX: 1 {cur['quote_currency']} = {rate} {sec}"
    if cur.get("rate_source"):
        fx += f" ({cur['rate_source']}{', live' if cur.get('rate_live') else ''})"
    story.append(Paragraph(fx, ss["Small"]))
    story.append(Paragraph(
        "All figures are logged verbatim from the negotiation calls; competitor comparisons and red flags are "
        "checked against published benchmarks. No figure in this report is generated by an AI model.",
        ss["Small"]))

    doc.build(story)
    return buf.getvalue()
