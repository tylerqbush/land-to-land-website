"""
Professional branded PDF report generator for Land to Land Holdings LLC.
Uses ReportLab Platypus for clean, multi-page output.
"""

import logging
from datetime import datetime
from io import BytesIO
from typing import Optional

from reportlab.lib import colors
from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    BaseDocTemplate, Frame, HRFlowable, NextPageTemplate,
    PageBreak, PageTemplate, Paragraph, Spacer, Table, TableStyle,
    KeepTogether,
)

logger = logging.getLogger(__name__)

# ── Brand colors ─────────────────────────────────────────────────────────────
DARK_GREEN = HexColor("#1B4332")
MID_GREEN = HexColor("#2D6A4F")
LIGHT_GREEN = HexColor("#D8F3DC")
DARK_GRAY = HexColor("#2D2D2D")
MED_GRAY = HexColor("#6B7280")
LIGHT_GRAY = HexColor("#F3F4F6")
WHITE = colors.white
BLACK = colors.black

BADGE_ACCEPT = HexColor("#16A34A")
BADGE_DECLINE = HexColor("#DC2626")
BADGE_SECOND = HexColor("#D97706")

W, H = letter
MARGIN = 0.75 * inch


def _make_styles():
    base = getSampleStyleSheet()
    styles = {
        "title": ParagraphStyle(
            "title", fontName="Helvetica-Bold", fontSize=20,
            textColor=WHITE, alignment=TA_CENTER, spaceAfter=4,
        ),
        "subtitle": ParagraphStyle(
            "subtitle", fontName="Helvetica", fontSize=11,
            textColor=WHITE, alignment=TA_CENTER, spaceAfter=4,
        ),
        "prop_id": ParagraphStyle(
            "prop_id", fontName="Helvetica", fontSize=9,
            textColor=HexColor("#B7E4C7"), alignment=TA_CENTER,
        ),
        "section_header": ParagraphStyle(
            "section_header", fontName="Helvetica-Bold", fontSize=10,
            textColor=WHITE, alignment=TA_LEFT, leftIndent=6, spaceAfter=4,
        ),
        "body": ParagraphStyle(
            "body", fontName="Helvetica", fontSize=9,
            textColor=DARK_GRAY, leading=14,
        ),
        "body_bold": ParagraphStyle(
            "body_bold", fontName="Helvetica-Bold", fontSize=9,
            textColor=DARK_GRAY, leading=14,
        ),
        "small": ParagraphStyle(
            "small", fontName="Helvetica", fontSize=8,
            textColor=MED_GRAY, leading=12,
        ),
        "badge": ParagraphStyle(
            "badge", fontName="Helvetica-Bold", fontSize=14,
            textColor=WHITE, alignment=TA_CENTER,
        ),
        "warning": ParagraphStyle(
            "warning", fontName="Helvetica-Bold", fontSize=9,
            textColor=HexColor("#92400E"), backColor=HexColor("#FEF3C7"),
            borderColor=HexColor("#D97706"), borderWidth=1, leading=13,
        ),
    }
    return styles


# ── Page template with footer ─────────────────────────────────────────────────

class _DDRDoc(BaseDocTemplate):
    def __init__(self, buf, prop_id, **kwargs):
        super().__init__(buf, pagesize=letter, **kwargs)
        self.prop_id = prop_id
        frame = Frame(MARGIN, MARGIN + 0.35 * inch, W - 2 * MARGIN,
                      H - 2 * MARGIN - 0.35 * inch, id="main")
        template = PageTemplate(id="main", frames=[frame],
                                onPage=self._draw_footer)
        self.addPageTemplates([template])

    def _draw_footer(self, canvas, doc):
        canvas.saveState()
        canvas.setFont("Helvetica", 7)
        canvas.setFillColor(MED_GRAY)
        footer_y = MARGIN - 0.05 * inch
        canvas.drawString(MARGIN, footer_y,
                          "Land to Land Holdings LLC  |  Confidential")
        canvas.drawRightString(W - MARGIN, footer_y,
                               f"Page {doc.page}")
        canvas.restoreState()


# ── Section header helper ─────────────────────────────────────────────────────

def _section(title: str, styles: dict) -> list:
    header_table = Table(
        [[Paragraph(title.upper(), styles["section_header"])]],
        colWidths=[W - 2 * MARGIN],
        rowHeights=[20],
    )
    header_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), DARK_GREEN),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    return [Spacer(1, 8), header_table, Spacer(1, 4)]


def _field_table(rows: list, styles: dict) -> Table:
    """Two-column label/value table for property details."""
    data = []
    for label, value in rows:
        v = str(value) if value else "Requires Manual Verification"
        data.append([
            Paragraph(label, styles["body_bold"]),
            Paragraph(v, styles["body"]),
        ])
    t = Table(data, colWidths=[2.2 * inch, W - 2 * MARGIN - 2.4 * inch])
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [WHITE, LIGHT_GRAY]),
        ("LINEBELOW", (0, 0), (-1, -1), 0.25, HexColor("#E5E7EB")),
    ]))
    return t


def _mv(value, fallback: str = "Requires Manual Verification") -> str:
    """Return value or manual verification placeholder."""
    if value is None or value == "" or value == "null":
        return fallback
    return str(value)


# ── Main generator ────────────────────────────────────────────────────────────

def generate_report(data: dict) -> bytes:
    """
    data keys expected:
      property_data, parcel, research, comps, pricing, recommendation
    Returns PDF bytes.
    """
    buf = BytesIO()
    styles = _make_styles()

    prop = data.get("property_data", {})
    parcel = data.get("parcel", {})
    research = data.get("research", {})
    comps_data = data.get("comps", {})
    pricing = data.get("pricing", {})
    rec = data.get("recommendation", {})

    zoning = research.get("zoning", {})
    utilities = research.get("utilities", {})
    flood = research.get("flood", {})
    contacts = research.get("contacts", {})
    location = research.get("location", {})
    elevation = research.get("elevation", {})
    access = research.get("access", {})

    apn = prop.get("apn", "Unknown")
    county = prop.get("county", "")
    state = prop.get("state", "")
    prop_id = f"{state}-{county}-{apn}"
    report_date = datetime.utcnow().strftime("%B %d, %Y")

    doc = _DDRDoc(buf, prop_id,
                  leftMargin=MARGIN, rightMargin=MARGIN,
                  topMargin=MARGIN, bottomMargin=MARGIN + 0.35 * inch)

    story = []

    # ── Cover header ──────────────────────────────────────────────────────────
    cover_table = Table(
        [[Paragraph("LAND TO LAND HOLDINGS LLC", styles["title"])],
         [Paragraph("Comprehensive Due Diligence Report", styles["subtitle"])],
         [Paragraph(f"Property ID: {prop_id}", styles["prop_id"])],
         [Paragraph(f"Report Date: {report_date}  |  Generated by Automated System",
                    styles["prop_id"])]],
        colWidths=[W - 2 * MARGIN],
    )
    cover_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), DARK_GREEN),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("ROUNDEDCORNERS", [4]),
    ]))
    story.append(cover_table)
    story.append(Spacer(1, 12))

    # ── Decision badge ────────────────────────────────────────────────────────
    decision = rec.get("decision", "Request Second-Opinion")
    if decision == "Accept and Close":
        badge_color = BADGE_ACCEPT
        badge_text = "ACCEPT AND CLOSE"
        badge_symbol = "✓"
    elif decision == "Decline":
        badge_color = BADGE_DECLINE
        badge_text = "DECLINE"
        badge_symbol = "✗"
    else:
        badge_color = BADGE_SECOND
        badge_text = "REQUEST SECOND OPINION"
        badge_symbol = "⚠"

    badge_inner = Paragraph(f"{badge_symbol}  {badge_text}", styles["badge"])
    badge_table = Table([[badge_inner]],
                        colWidths=[W - 2 * MARGIN], rowHeights=[36])
    badge_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), badge_color),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ROUNDEDCORNERS", [6]),
    ]))
    story.append(badge_table)
    story.append(Spacer(1, 6))

    # Quick summary line
    acq_display = pricing.get("acquisition_price_display", "N/A")
    retail = pricing.get("retail_cash_price", 0)
    dom = rec.get("est_days_sell", 0)
    story.append(Paragraph(
        f"<b>Recommended Acquisition Price:</b> {acq_display}  &nbsp;&nbsp;&nbsp; "
        f"<b>Retail Cash Price:</b> ${retail:,.0f}  &nbsp;&nbsp;&nbsp; "
        f"<b>Est. Days to Sell:</b> {dom}",
        styles["body"],
    ))
    story.append(Spacer(1, 10))
    story.append(HRFlowable(width="100%", thickness=0.5, color=MED_GRAY))

    # ── 1. Property Identification ────────────────────────────────────────────
    story += _section("1. Property Identification", styles)
    gps = parcel.get("gps_coordinates") or prop.get("gps_coordinates", "")
    maps_link = ""
    if gps:
        clean = gps.replace(" ", "+")
        maps_link = f"https://maps.google.com/?q={clean}"

    rows = [
        ("APN / Parcel ID", apn),
        ("County / State", f"{county}, {state}"),
        ("Subdivision", _mv(prop.get("subdivision"))),
        ("Acreage", _mv(parcel.get("acreage") or prop.get("size"))),
        ("Owner Name", _mv(parcel.get("owner_name"))),
        ("Mailing Address", _mv(parcel.get("mailing_address"))),
        ("Full Legal Description", _mv(parcel.get("legal_description"))),
        ("Short Legal", _mv(parcel.get("short_legal"))),
        ("GPS Coordinates", _mv(gps)),
        ("Google Maps", maps_link if maps_link else "Requires Manual Verification"),
    ]
    story.append(_field_table(rows, styles))

    # ── 2. Land Details and Access ────────────────────────────────────────────
    story += _section("2. Land Details and Access", styles)
    rows = [
        ("Terrain", _mv(elevation.get("terrain_description"))),
        ("Elevation", f"{_mv(elevation.get('elevation_feet'))} ft" if elevation.get("elevation_feet") else "Requires Manual Verification"),
        ("Lot Dimensions", _mv(parcel.get("lot_dimensions"))),
        ("Road Type", _mv(access.get("road_type"))),
        ("Nearest Highway", _mv(access.get("nearest_highway"))),
        ("Legal Access Status", _mv(access.get("legal_access_status"))),
        ("Access Notes", _mv(access.get("access_notes"))),
    ]
    story.append(_field_table(rows, styles))

    # ── 3. Location Highlights ────────────────────────────────────────────────
    story += _section("3. Location Highlights", styles)
    major_city = location.get("nearest_major_city", "")
    major_miles = location.get("nearest_major_city_miles", "")
    small_town = location.get("nearest_small_town", "")
    small_miles = location.get("nearest_small_town_miles", "")
    rows = [
        ("Nearest Major City", f"{_mv(major_city)} ({_mv(major_miles)} mi)" if major_city and major_miles else _mv(major_city)),
        ("Nearest Small Town", f"{_mv(small_town)} ({_mv(small_miles)} mi)" if small_town and small_miles else _mv(small_town)),
        ("Nearby Attractions", _mv(location.get("nearby_attractions"))),
        ("Nearest Hospital", _mv(location.get("nearest_hospital"))),
        ("School District", _mv(location.get("nearest_school_district"))),
        ("Nearest Grocery", _mv(location.get("nearest_grocery"))),
    ]
    story.append(_field_table(rows, styles))

    # ── 4. Tax and Valuation ──────────────────────────────────────────────────
    story += _section("4. Tax and Valuation", styles)
    rows = [
        ("Assessed Value", _mv(parcel.get("assessed_value"))),
        ("Land Value", _mv(parcel.get("land_value"))),
        ("Annual Taxes", _mv(parcel.get("annual_taxes"))),
        ("Deed Info", _mv(parcel.get("deed_info"))),
    ]
    story.append(_field_table(rows, styles))

    # ── 5. Zoning and Restrictions ────────────────────────────────────────────
    story += _section("5. Zoning and Restrictions", styles)
    rows = [
        ("Zoning Code", _mv(zoning.get("zoning_code"))),
        ("Zoning Designation", _mv(zoning.get("zoning_designation"))),
        ("Permitted Uses Summary", _mv(zoning.get("permitted_uses_summary"))),
        ("Single Family Homes", _mv(zoning.get("single_family_homes"))),
        ("Modular Homes", _mv(zoning.get("modular_homes"))),
        ("Manufactured Homes", _mv(zoning.get("manufactured_homes"))),
        ("Tiny Home Friendly", _mv(zoning.get("tiny_home_friendly"))),
        ("Camping Allowed", _mv(zoning.get("camping_allowed"))),
        ("Tent Camping", _mv(zoning.get("tent_camping"))),
        ("Full-Time RV Living", _mv(zoning.get("fulltime_rv_living"))),
        ("RV Allowed While Building", _mv(zoning.get("rv_while_building"))),
        ("Hunting Allowed", _mv(zoning.get("hunting_allowed"))),
        ("HOA / POA", _mv(zoning.get("hoa_poa"))),
        ("Setbacks", _mv(zoning.get("setbacks_summary"))),
        ("Time Limit to Build", _mv(zoning.get("time_limit_to_build"))),
        ("Building Permit Notes", _mv(zoning.get("building_permit_notes"))),
    ]
    story.append(_field_table(rows, styles))

    # ── 6. Utility Information ────────────────────────────────────────────────
    story += _section("6. Utility Information", styles)
    rows = [
        ("Well / Water", _mv(utilities.get("well_allowed"))),
        ("Septic Required", _mv(utilities.get("septic_required"))),
        ("Septic Installation Allowed", _mv(utilities.get("septic_install_allowed"))),
        ("Electricity Available", _mv(utilities.get("electricity_available"))),
        ("Electricity Provider", _mv(utilities.get("electricity_provider"))),
        ("Electricity Notes", _mv(utilities.get("electricity_notes"))),
        ("Gas / Propane Allowed", _mv(utilities.get("propane_allowed"))),
        ("Solar Allowed", _mv(utilities.get("solar_allowed"))),
        ("Trash Service", _mv(utilities.get("trash_service"))),
    ]
    story.append(_field_table(rows, styles))

    # ── 7. Environmental ──────────────────────────────────────────────────────
    story += _section("7. Environmental", styles)
    fz = flood.get("flood_zone_designation", "")
    fz_risk = flood.get("flood_risk_level", "")
    if fz and fz.upper() in ("A", "AE", "AH", "AO", "VE", "V"):
        fz_display = f"{fz} — HIGH RISK (Red Flag)"
    elif fz:
        fz_display = f"{fz} — {fz_risk}" if fz_risk else fz
    else:
        fz_display = "Requires Manual Verification"
    rows = [
        ("FEMA Flood Zone", fz_display),
        ("Flood Risk Level", _mv(flood.get("flood_risk_level"))),
        ("Flood Notes", _mv(flood.get("flood_notes"))),
    ]
    story.append(_field_table(rows, styles))

    # ── 8. Sold Comps ─────────────────────────────────────────────────────────
    story += _section("8. Sold Comps — Vacant Land Only", styles)

    comps_list = comps_data.get("comps", [])
    if comps_data.get("warning"):
        story.append(Paragraph(comps_data["warning"], styles["warning"]))
        story.append(Spacer(1, 4))

    if comps_list:
        comp_headers = ["Acreage", "Sold Price", "$/Acre", "List Date", "Sold Date", "DOM", "Source"]
        comp_rows = [comp_headers]
        for c in comps_list:
            price = c.get("sold_price", 0)
            ppa = c.get("price_per_acre", 0)
            comp_rows.append([
                f"{c.get('acreage', 'N/A')}",
                f"${price:,.0f}" if price else "N/A",
                f"${ppa:,.0f}" if ppa else "N/A",
                c.get("list_date", "N/A"),
                c.get("sold_date", "N/A"),
                str(c.get("dom", "N/A")),
                c.get("source", "N/A"),
            ])
        col_widths = [0.8*inch, 0.9*inch, 0.8*inch, 0.9*inch, 0.9*inch, 0.6*inch, 0.9*inch]
        ct = Table(comp_rows, colWidths=col_widths)
        ct.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), DARK_GREEN),
            ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, LIGHT_GRAY]),
            ("GRID", (0, 0), (-1, -1), 0.25, HexColor("#D1D5DB")),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ]))
        story.append(ct)
        story.append(Spacer(1, 6))

        # Metrics summary
        med_price = comps_data.get("median_price", 0)
        med_ppa = comps_data.get("median_price_per_acre", 0)
        med_dom = comps_data.get("median_dom", 0)
        n = comps_data.get("sample_size", 0)
        story.append(Paragraph(
            f"<b>Median Sold Price:</b> ${med_price:,.0f}  &nbsp; "
            f"<b>Median $/Acre:</b> ${med_ppa:,.0f}  &nbsp; "
            f"<b>Median DOM:</b> {med_dom:.0f} days  &nbsp; "
            f"<b>Sample Size:</b> {n} comps",
            styles["body"],
        ))

        # URLs
        urls = [c.get("url", "") for c in comps_list if c.get("url")]
        if urls:
            story.append(Spacer(1, 4))
            story.append(Paragraph("<b>Comp URLs:</b>", styles["body_bold"]))
            for i, url in enumerate(urls, 1):
                story.append(Paragraph(f"{i}. {url}", styles["small"]))
    else:
        story.append(Paragraph("No valid vacant land comps found.", styles["body"]))

    # ── 9. County Resources ───────────────────────────────────────────────────
    story += _section("9. County Resources", styles)
    contact_list = contacts.get("contacts", [])
    if contact_list:
        cr_headers = ["Department", "Website", "Phone"]
        cr_rows = [cr_headers]
        for c in contact_list:
            cr_rows.append([
                c.get("department", ""),
                c.get("website", ""),
                c.get("phone", ""),
            ])
        ct = Table(cr_rows, colWidths=[1.8*inch, 3.2*inch, 1.5*inch])
        ct.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), DARK_GREEN),
            ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, LIGHT_GRAY]),
            ("GRID", (0, 0), (-1, -1), 0.25, HexColor("#D1D5DB")),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ]))
        story.append(ct)
    else:
        story.append(Paragraph("County contact research pending — see manual lookup.", styles["body"]))

    # ── 10. Recommendation ────────────────────────────────────────────────────
    story += _section("10. Recommendation", styles)
    story.append(badge_table)
    story.append(Spacer(1, 8))

    rec_rows = [
        ("Recommended Acquisition Price", pricing.get("acquisition_price_display", "N/A")),
        ("Retail Cash Price", f"${pricing.get('retail_cash_price', 0):,.0f}"),
        ("Estimated Days to Sell", str(rec.get("est_days_sell", "N/A"))),
        ("Red Flags", ", ".join(rec.get("red_flags", ["None"]))),
        ("Market Rule Applied", pricing.get("market", "N/A")),
    ]
    story.append(_field_table(rec_rows, styles))
    story.append(Spacer(1, 8))
    story.append(Paragraph(rec.get("reasoning", ""), styles["body"]))

    # ── 11. Missing Data Notice ───────────────────────────────────────────────
    manual = parcel.get("manual_lookup_required", [])
    if manual:
        story += _section("11. Missing Data — Manual Verification Required", styles)
        story.append(Paragraph(
            "The following fields could not be confirmed through automated research. "
            "Please verify manually before making an acquisition decision:",
            styles["body"],
        ))
        story.append(Spacer(1, 4))
        for field in manual:
            story.append(Paragraph(f"  • {field.replace('_', ' ').title()}", styles["body"]))

    doc.build(story)
    return buf.getvalue()
