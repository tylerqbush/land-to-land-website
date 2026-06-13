"""
Three-layer parcel data retrieval:
  Layer 1 — County assessor scraping (Playwright for Klamath OR; requests for Luna NM & Putnam FL)
  Layer 2 — Anthropic web_search fallback for any missing fields
  Layer 3 — Flag remaining unknowns under manual_lookup_required
"""

import os
import logging
import re
import time
from typing import Optional

import requests
from bs4 import BeautifulSoup

from research import run_web_search

logger = logging.getLogger(__name__)

PARCEL_FIELDS = [
    "owner_name",
    "mailing_address",
    "legal_description",
    "acreage",
    "assessed_value",
    "land_value",
    "annual_taxes",
    "deed_info",
    "map_taxlot",
    "gps_coordinates",
    "lot_dimensions",
    "short_legal",
]


def scrape_parcel_data(apn: str, county: str, state: str) -> dict:
    """
    Run all three layers and return a combined parcel dict.
    Keys with value None indicate data that could not be found.
    """
    logger.info("Layer 1 — County assessor scrape: %s %s %s", apn, county, state)
    data = {}

    try:
        county_lower = county.lower().replace(" county", "").strip()
        if "klamath" in county_lower and state.upper() == "OR":
            data = _scrape_klamath(apn)
        elif "luna" in county_lower and state.upper() == "NM":
            data = _scrape_luna(apn)
        elif "putnam" in county_lower and state.upper() == "FL":
            data = _scrape_putnam(apn)
        else:
            logger.info("No dedicated scraper for %s %s — skipping to Layer 2", county, state)
    except Exception as exc:
        logger.warning("Layer 1 scraper error: %s", exc)

    # Layer 2 — fill any missing fields via web search
    missing = [f for f in PARCEL_FIELDS if not data.get(f)]
    if missing:
        logger.info("Layer 2 — web search fallback for: %s", missing)
        data = _web_search_fallback(apn, county, state, data, missing)

    # Layer 3 — flag remaining unknowns
    still_missing = [f for f in PARCEL_FIELDS if not data.get(f)]
    if still_missing:
        logger.info("Layer 3 — fields requiring manual lookup: %s", still_missing)
        data["manual_lookup_required"] = still_missing

    return data


# ── Klamath County OR (Playwright — JavaScript required) ─────────────────────

def _scrape_klamath(apn: str) -> dict:
    """Use Playwright headless Chromium to query the Klamath County assessor portal."""
    try:
        from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout
    except ImportError:
        logger.warning("Playwright not installed — skipping Klamath Layer 1")
        return {}

    result = {}
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            page.goto("https://assessor.klamathcounty.org/PSO/", timeout=30000)
            page.wait_for_load_state("networkidle", timeout=20000)

            # Try typing the APN into a search box (common patterns)
            for selector in ['input[name*="apn"]', 'input[name*="parcel"]',
                              'input[id*="apn"]', 'input[id*="search"]',
                              'input[placeholder*="APN"]', 'input[type="text"]']:
                try:
                    page.fill(selector, apn, timeout=3000)
                    page.keyboard.press("Enter")
                    page.wait_for_load_state("networkidle", timeout=15000)
                    break
                except PWTimeout:
                    continue

            html = page.content()
            soup = BeautifulSoup(html, "lxml")
            result = _parse_assessor_html(soup, apn)
        except Exception as exc:
            logger.warning("Klamath Playwright scrape failed: %s", exc)
        finally:
            browser.close()

    return result


# ── Luna County NM ───────────────────────────────────────────────────────────

def _scrape_luna(apn: str) -> dict:
    """Attempt to scrape the Luna County NM assessor portal."""
    result = {}
    session = requests.Session()
    session.headers.update({"User-Agent": "Mozilla/5.0 (compatible; DDRBot/1.0)"})

    base_url = "https://www.lunacountynm.us"
    try:
        resp = session.get(f"{base_url}/departments/assessor", timeout=20)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "lxml")

        # Look for a GIS or property search link
        search_link = None
        for a in soup.find_all("a", href=True):
            href_text = (a.get_text() + a["href"]).lower()
            if any(k in href_text for k in ["gis", "property search", "parcel search", "assessor search"]):
                search_link = a["href"]
                break

        if search_link:
            if not search_link.startswith("http"):
                search_link = base_url + search_link
            resp2 = session.get(search_link, timeout=20)
            resp2.raise_for_status()
            soup2 = BeautifulSoup(resp2.text, "lxml")

            # Try to find a search form
            forms = soup2.find_all("form")
            for form in forms:
                inputs = form.find_all("input", {"type": "text"})
                if inputs:
                    action = form.get("action", search_link)
                    if not action.startswith("http"):
                        action = base_url + action
                    form_data = {i.get("name", ""): apn for i in inputs if i.get("name")}
                    resp3 = session.post(action, data=form_data, timeout=20)
                    result = _parse_assessor_html(BeautifulSoup(resp3.text, "lxml"), apn)
                    break
    except Exception as exc:
        logger.warning("Luna NM scrape failed: %s", exc)

    return result


# ── Putnam County FL ─────────────────────────────────────────────────────────

def _scrape_putnam(apn: str) -> dict:
    """Scrape Putnam County FL Property Appraiser portal."""
    result = {}
    session = requests.Session()
    session.headers.update({"User-Agent": "Mozilla/5.0 (compatible; DDRBot/1.0)"})

    try:
        # Putnam PA public search
        search_url = "https://www.putnam-fl.com/pa/search.aspx"
        resp = session.get(search_url, timeout=20)
        if not resp.ok:
            search_url = "https://www.putnam-fl.com/pa/"
            resp = session.get(search_url, timeout=20)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "lxml")

        # Look for parcel/APN search form
        form = soup.find("form")
        if form:
            inputs = form.find_all("input")
            viewstate = {}
            for inp in inputs:
                nm = inp.get("name", "")
                if "__" in nm:
                    viewstate[nm] = inp.get("value", "")

            # Try common Putnam search param names
            for field_name in ["txtParcel", "txtAPN", "parcel", "apn", "query"]:
                post_data = {**viewstate, field_name: apn, "__EVENTTARGET": "", "__EVENTARGUMENT": ""}
                action = form.get("action", search_url)
                if not action.startswith("http"):
                    action = "https://www.putnam-fl.com" + action
                resp2 = session.post(action, data=post_data, timeout=20)
                if resp2.ok and apn.lower() in resp2.text.lower():
                    result = _parse_assessor_html(BeautifulSoup(resp2.text, "lxml"), apn)
                    if result:
                        break
    except Exception as exc:
        logger.warning("Putnam FL scrape failed: %s", exc)

    return result


# ── Generic HTML parser ───────────────────────────────────────────────────────

def _parse_assessor_html(soup: BeautifulSoup, apn: str) -> dict:
    """
    Best-effort extraction of parcel fields from an assessor result page.
    Looks for label/value pairs in tables and definition lists.
    """
    result = {}
    text = soup.get_text(separator=" ", strip=True)

    # Acreage
    m = re.search(r"(\d+\.?\d*)\s*acres?", text, re.I)
    if m:
        result["acreage"] = m.group(1)

    # Annual taxes / tax amount
    m = re.search(r"(?:tax(?:es)?|amount due)[:\s$]+([0-9,]+\.?\d*)", text, re.I)
    if m:
        result["annual_taxes"] = m.group(1).replace(",", "")

    # Assessed / total value
    m = re.search(r"(?:assessed|total)\s*value[:\s$]+([0-9,]+)", text, re.I)
    if m:
        result["assessed_value"] = m.group(1).replace(",", "")

    # Land value
    m = re.search(r"land\s*value[:\s$]+([0-9,]+)", text, re.I)
    if m:
        result["land_value"] = m.group(1).replace(",", "")

    # Owner name — look for table rows with "owner" label
    m = re.search(r"(?:owner|owner\s*name)[:\s]+([A-Z][A-Z\s,&.'-]{3,60})", text, re.I)
    if m:
        result["owner_name"] = m.group(1).strip()

    # Mailing address
    m = re.search(r"(?:mail(?:ing)?\s*address)[:\s]+(.{10,80}?\d{5})", text, re.I)
    if m:
        result["mailing_address"] = m.group(1).strip()

    # Legal description
    m = re.search(r"(?:legal\s*description|legal)[:\s]+(.{20,300}?)(?:\s{3,}|\n)", text, re.I)
    if m:
        result["legal_description"] = m.group(1).strip()

    return result


# ── Web-search fallback ───────────────────────────────────────────────────────

def _web_search_fallback(apn: str, county: str, state: str,
                          existing: dict, missing_fields: list) -> dict:
    """Use Anthropic web_search to fill in missing parcel fields."""
    queries = [
        f'"{apn}" {county} County {state} assessor owner name acreage',
        f'"{apn}" {county} County {state} property tax assessed value',
        f'"{apn}" {county} {state} legal description deed',
    ]

    combined_text = ""
    for q in queries:
        try:
            result_text = run_web_search(
                f"Search for parcel data and return ONLY confirmed facts. Query: {q}\n\n"
                f"Return a JSON object with any of these fields you find: "
                f"owner_name, mailing_address, legal_description, acreage, "
                f"assessed_value, land_value, annual_taxes, gps_coordinates. "
                f"Only include fields where you have high confidence the data is for APN {apn}. "
                f"Do not guess or infer."
            )
            combined_text += result_text + "\n"
        except Exception as exc:
            logger.warning("Web search fallback query failed: %s", exc)
        time.sleep(1)

    # Try to parse JSON from the combined response
    import json
    data = dict(existing)
    try:
        json_match = re.search(r'\{[^{}]+\}', combined_text, re.DOTALL)
        if json_match:
            parsed = json.loads(json_match.group())
            for k, v in parsed.items():
                if k in PARCEL_FIELDS and v and not data.get(k):
                    data[k] = v
    except Exception as exc:
        logger.warning("Could not parse web search JSON response: %s", exc)

    return data
