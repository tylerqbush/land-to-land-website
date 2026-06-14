"""
Main DDR pipeline orchestrator.
Runs all 9 steps in order, wrapping each in try/except so one failure
never crashes the entire pipeline.
"""

import json
import logging
import os
import traceback
from datetime import datetime

import airtable as at
from parcel_scraper import scrape_parcel_data
from research import research_all
from comps import find_vacant_land_comps
from pricing import calculate_pricing
from recommendation import generate_recommendation
from pdf_generator import generate_report
from drive_uploader import upload_pdf

logger = logging.getLogger(__name__)

# Synthetic property used for the /test endpoint
TEST_PROPERTY = {
    "apn": "R258820",
    "state": "OR",
    "county": "Klamath",
    "subdivision": "",
    "size": "5",
    "drive_folder_id": "",
}


def run_pipeline(record_id: str, test_mode: bool = False) -> None:
    """Entry point called by FastAPI BackgroundTasks."""
    run_at = datetime.utcnow().isoformat()
    pipeline_errors: list = []
    logger.info("Pipeline START — record=%s test=%s", record_id, test_mode)

    # ── Fetch property data ───────────────────────────────────────────────────
    if test_mode:
        property_data = TEST_PROPERTY
        raw_fields = {}
    else:
        try:
            raw_fields = at.get_record(record_id)
            property_data = {
                "apn":           raw_fields.get(at.F_APN, ""),
                "state":         raw_fields.get(at.F_STATE, ""),
                "county":        raw_fields.get(at.F_COUNTY, ""),
                "subdivision":   raw_fields.get(at.F_SUBDIVISION, ""),
                "size":          str(raw_fields.get(at.F_SIZE, "")),
                "drive_folder_id": raw_fields.get(at.F_DRIVE_FOLDER_ID, ""),
            }
            logger.info("Property data: %s", property_data)
        except Exception as exc:
            logger.error("FATAL — could not fetch Airtable record %s: %s", record_id, exc)
            return

    apn = property_data["apn"]
    county = property_data["county"]
    state = property_data["state"]
    subdivision = property_data.get("subdivision", "")
    acreage = property_data.get("size", "")
    folder_id = property_data.get("drive_folder_id", "")
    prop_id = f"{state}-{county}-{apn}"

    # Accumulate all data for the final write-back and PDF
    collected: dict = {
        "property_data": property_data,
        "parcel": {},
        "research": {},
        "comps": {},
        "pricing": {},
        "recommendation": {},
    }

    # ── Step 1 — Parcel data ──────────────────────────────────────────────────
    logger.info("Step 1 — parcel scrape")
    try:
        collected["parcel"] = scrape_parcel_data(apn, county, state)
        logger.info("Parcel data: %s", {k: v for k, v in collected["parcel"].items() if k != "manual_lookup_required"})
    except Exception as exc:
        logger.error("Step 1 failed: %s", exc)
        pipeline_errors.append(f"Step 1 (parcel scrape): {exc}")
        collected["parcel"] = {"manual_lookup_required": ["all parcel fields"]}

    # ── Step 2 — Web research ─────────────────────────────────────────────────
    logger.info("Step 2 — web research")
    try:
        collected["research"] = research_all(county, state, apn, subdivision)
    except Exception as exc:
        logger.error("Step 2 failed: %s", exc)
        pipeline_errors.append(f"Step 2 (research): {exc}")

    # ── Step 3 — Comps ────────────────────────────────────────────────────────
    logger.info("Step 3 — comps search")
    try:
        collected["comps"] = find_vacant_land_comps(county, state, subdivision, acreage)
        logger.info(
            "Comps: %d valid, median $%s, low_confidence=%s",
            collected["comps"].get("sample_size", 0),
            collected["comps"].get("median_price", 0),
            collected["comps"].get("low_confidence", True),
        )
    except Exception as exc:
        logger.error("Step 3 failed: %s", exc)
        pipeline_errors.append(f"Step 3 (comps): {exc}")
        collected["comps"] = {
            "comps": [], "median_price": 0, "median_price_per_acre": 0,
            "median_dom": 0, "sample_size": 0,
            "low_confidence": True,
            "warning": "⚠️ Comp search failed — manual comp research required.",
        }

    # ── Step 4 — Pricing ──────────────────────────────────────────────────────
    logger.info("Step 4 — pricing")
    try:
        median_price = collected["comps"].get("median_price", 0)
        collected["pricing"] = calculate_pricing(county, state, median_price)
    except Exception as exc:
        logger.error("Step 4 failed: %s", exc)
        pipeline_errors.append(f"Step 4 (pricing): {exc}")
        collected["pricing"] = {
            "acquisition_price": 0,
            "acquisition_price_display": "N/A",
            "retail_cash_price": 0,
            "market": "unknown",
        }

    # ── Step 5 — Recommendation ───────────────────────────────────────────────
    logger.info("Step 5 — recommendation")
    try:
        collected["recommendation"] = generate_recommendation(
            property_data=collected["property_data"],
            research=collected["research"],
            comps=collected["comps"],
            pricing=collected["pricing"],
        )
    except Exception as exc:
        logger.error("Step 5 failed: %s", exc)
        pipeline_errors.append(f"Step 5 (recommendation): {exc}")
        collected["recommendation"] = {
            "decision": "Request Second-Opinion",
            "reasoning": "⚠️ Automated recommendation failed — manual review required.",
            "red_flags": ["None"],
            "est_days_sell": 90,
        }

    # ── Step 6 — Generate PDF ─────────────────────────────────────────────────
    pdf_bytes = None
    logger.info("Step 6 — generate PDF")
    try:
        pdf_bytes = generate_report(collected)
        logger.info("PDF generated — %d bytes", len(pdf_bytes))
    except Exception as exc:
        logger.error("Step 6 failed: %s\n%s", exc, traceback.format_exc())
        pipeline_errors.append(f"Step 6 (PDF generation): {exc}")

    # ── Step 7 — Upload to Drive ──────────────────────────────────────────────
    pdf_url = ""
    logger.info("Step 7 — upload to Drive")
    if pdf_bytes and not test_mode:
        try:
            filename = f"Due_Diligence_Report_{prop_id}.pdf"
            pdf_url = upload_pdf(pdf_bytes, filename, folder_id)
            logger.info("PDF uploaded: %s", pdf_url)
        except Exception as exc:
            logger.error("Step 7 failed: %s", exc)
            pipeline_errors.append(f"Step 7 (Drive upload): {exc}")
    elif test_mode:
        logger.info("Step 7 skipped — test mode")

    # ── Step 8 — Write back to Airtable ──────────────────────────────────────
    logger.info("Step 8 — write back to Airtable")
    if not test_mode:
        try:
            _write_airtable(record_id, collected, pdf_url, pipeline_errors, raw_fields)
        except Exception as exc:
            logger.error("Step 8 failed: %s\n%s", exc, traceback.format_exc())
            pipeline_errors.append(f"Step 8 (Airtable write): {exc}")
    else:
        logger.info("Step 8 skipped — test mode. Full data summary:")
        logger.info(json.dumps({
            "property_id": prop_id,
            "decision": collected["recommendation"].get("decision"),
            "acquisition_price": collected["pricing"].get("acquisition_price_display"),
            "comp_count": collected["comps"].get("sample_size"),
            "pipeline_errors": pipeline_errors,
        }, indent=2))

    status = "COMPLETE" if not pipeline_errors else f"COMPLETE WITH {len(pipeline_errors)} ERROR(S)"
    logger.info("Pipeline %s — record=%s — %s", status, record_id, run_at)


# ── Airtable write-back ───────────────────────────────────────────────────────

def _write_airtable(record_id: str, collected: dict, pdf_url: str,
                    pipeline_errors: list, raw_fields: dict) -> None:
    parcel = collected["parcel"]
    research = collected["research"]
    comps = collected["comps"]
    pricing = collected["pricing"]
    rec = collected["recommendation"]

    zoning = research.get("zoning", {})
    utilities = research.get("utilities", {})
    flood = research.get("flood", {})
    access = research.get("access", {})
    location = research.get("location", {})
    elevation = research.get("elevation", {})

    # Build reasoning string
    reasoning = rec.get("reasoning", "")
    if parcel.get("manual_lookup_required"):
        reasoning += (
            "\n\n⚠️ Some parcel fields require manual verification — see DD Raw JSON for details."
        )
    if pipeline_errors:
        reasoning += f"\n\n⚠️ Pipeline error(s): {'; '.join(pipeline_errors)}"

    # Comp summary
    n = comps.get("sample_size", 0)
    med = comps.get("median_price", 0)
    dom = comps.get("median_dom", 0)
    ppa = comps.get("median_price_per_acre", 0)
    comp_summary = (
        f"{n} vacant land comp(s) | Median: ${med:,.0f} | "
        f"Median $/acre: ${ppa:,.0f} | Median DOM: {dom:.0f} days"
    )
    if comps.get("warning"):
        comp_summary += f"\n{comps['warning']}"

    # Comp URLs
    comp_urls = "\n".join(
        c.get("url", "") for c in comps.get("comps", []) if c.get("url")
    )

    # GPS
    gps = parcel.get("gps_coordinates", "")

    # Nearby city
    city = location.get("nearest_major_city", "")
    city_mi = location.get("nearest_major_city_miles", "")
    town = location.get("nearest_small_town", "")
    town_mi = location.get("nearest_small_town_miles", "")
    nearby_city_str = ""
    if city:
        nearby_city_str = f"{city} ({city_mi} mi)"
    if town:
        nearby_city_str += f"; {town} ({town_mi} mi)"

    # Elevation
    elev = elevation.get("elevation_feet", "")
    elev_str = f"{elev} ft" if elev else ""

    # Full raw JSON
    raw_json = json.dumps({
        "parcel": parcel,
        "research": research,
        "comps": {k: v for k, v in comps.items() if k != "comps"},
        "comps_detail": comps.get("comps", []),
        "pricing": pricing,
        "recommendation": rec,
        "pdf_url": pdf_url,
        "pipeline_errors": pipeline_errors,
    }, default=str)

    # Build fields dict — only set fields where we have data
    fields: dict = {}

    def _set(field_id, value):
        if value is not None and value != "" and value != [] and value != {}:
            fields[field_id] = value

    _set(at.F_DD_RAW_JSON, raw_json[:100000])  # Airtable long-text limit
    _set(at.F_PROPERTY_DECISION, rec.get("decision"))
    _set(at.F_DECISION_REASONING, reasoning)
    _set(at.F_COMP_SUMMARY, comp_summary)
    _set(at.F_COMP_URLS, comp_urls)
    _set(at.F_RED_FLAGS, rec.get("red_flags", []))

    if comps.get("median_dom"):
        _set(at.F_EST_DAYS_TO_SELL, int(comps["median_dom"]))

    if pricing.get("retail_cash_price"):
        _set(at.F_CASH_PURCHASE_PRICE, pricing["retail_cash_price"])

    if pricing.get("acquisition_price"):
        _set(at.F_RECOMMENDED_ACQ_PRICE, pricing["acquisition_price"])

    # Parcel fields
    _set(at.F_ANNUAL_TAXES, parcel.get("annual_taxes"))
    _set(at.F_GPS, gps)
    _set(at.F_FULL_LEGAL, parcel.get("legal_description"))
    _set(at.F_SHORT_LEGAL, parcel.get("short_legal"))
    _set(at.F_LOT_DIMENSIONS, parcel.get("lot_dimensions"))

    # Research fields
    _set(at.F_ZONING, zoning.get("zoning_code"))
    _set(at.F_ZONING_DESIGNATION, zoning.get("zoning_designation"))
    _set(at.F_TERRAIN, elevation.get("terrain_description"))
    _set(at.F_ACCESS, access.get("road_type"))
    _set(at.F_LEGAL_ACCESS, access.get("legal_access_status"))
    _set(at.F_NEARBY_CITY, nearby_city_str)

    if elev_str:
        _set(at.F_ELEVATION, elev_str)

    # Flood plain checkbox
    fz = flood.get("flood_zone_designation", "")
    if fz:
        is_flood = fz.upper() not in ("X", "X500", "D", "")
        _set(at.F_FLOOD_PLAIN, is_flood)

    # Zoning boolean fields
    _yes_no_field(fields, at.F_SFH,           zoning.get("single_family_homes"))
    _yes_no_field(fields, at.F_MODULAR,        zoning.get("modular_homes"))
    _yes_no_field(fields, at.F_MANUFACTURED,   zoning.get("manufactured_homes"))
    _yes_no_field(fields, at.F_TINY_HOME,      zoning.get("tiny_home_friendly"))
    _yes_no_field(fields, at.F_TENT_CAMPING,   zoning.get("tent_camping"))
    _yes_no_field(fields, at.F_RV_FULLTIME,    zoning.get("fulltime_rv_living"))
    _yes_no_field(fields, at.F_RV_WHILE_BUILD, zoning.get("rv_while_building"))
    _yes_no_field(fields, at.F_RV_CAMPING,     zoning.get("rv_while_building"))
    _yes_no_field(fields, at.F_HUNTING,        zoning.get("hunting_allowed"))
    _yes_no_field(fields, at.F_HOA,            zoning.get("hoa_poa"))
    _yes_no_field(fields, at.F_MOBILE_HOME,    zoning.get("manufactured_homes"))
    _yes_no_field(fields, at.F_DRIVEWAY_REQ,   zoning.get("driveway_required"))
    _set(at.F_TIME_TO_BUILD, zoning.get("time_limit_to_build"))

    # Utility boolean fields
    _yes_no_field(fields, at.F_WELL,          utilities.get("well_allowed"))
    _yes_no_field(fields, at.F_SEPTIC_REQ,    utilities.get("septic_required"))
    _yes_no_field(fields, at.F_SEPTIC_INSTALL, utilities.get("septic_install_allowed"))
    _yes_no_field(fields, at.F_ELECTRICITY,   utilities.get("electricity_available"))
    _yes_no_field(fields, at.F_SOLAR,         utilities.get("solar_allowed"))
    _yes_no_field(fields, at.F_PROPANE,       utilities.get("propane_allowed"))
    _yes_no_field(fields, at.F_GAS,           utilities.get("gas_available"))

    # Drive Folder Link — append PDF URL (don't overwrite)
    if pdf_url:
        existing_link = raw_fields.get(at.F_DRIVE_FOLDER_LINK, "")
        if existing_link:
            _set(at.F_DRIVE_FOLDER_LINK, f"{existing_link}\n{pdf_url}")
        else:
            _set(at.F_DRIVE_FOLDER_LINK, pdf_url)

    # Set completion checkbox only if no critical failures
    critical_failed = any(
        f"Step {s}" in err for err in pipeline_errors
        for s in (6, 8)
    )
    if not critical_failed:
        fields[at.F_DD_EXTRACTED] = True

    at.update_record(record_id, fields)
    logger.info("Airtable write-back complete — %d fields updated", len(fields))


def _yes_no_field(fields: dict, field_id: str, value) -> None:
    """Convert a Yes/No/unknown string to a checkbox bool and add to fields dict."""
    if value is None:
        return
    s = str(value).lower().strip()
    if s in ("yes", "true", "1", "allowed", "permitted", "required"):
        fields[field_id] = True
    elif s in ("no", "false", "0", "not allowed", "not permitted", "not required", "prohibited"):
        fields[field_id] = False
