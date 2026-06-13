"""
Web research via Anthropic claude-sonnet-4-6 with the web_search built-in tool.
Each research function runs a targeted query and returns a structured dict.
"""

import os
import json
import logging
import re

import anthropic

logger = logging.getLogger(__name__)

MODEL = "claude-sonnet-4-6"
MAX_TOKENS = 8192
WEB_SEARCH_TOOL = {"type": "web_search_20250305", "name": "web_search", "max_uses": 5}


def run_web_search(prompt: str, system: str = "") -> str:
    """
    Call Claude with web_search enabled and return the final text response.
    Implements the agentic tool-use loop — Anthropic executes searches server-side.
    """
    client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))
    messages = [{"role": "user", "content": prompt}]

    for _ in range(12):
        kwargs = dict(
            model=MODEL,
            max_tokens=MAX_TOKENS,
            tools=[WEB_SEARCH_TOOL],
            messages=messages,
        )
        if system:
            kwargs["system"] = system

        response = client.messages.create(**kwargs)
        text_parts = [b.text for b in response.content if hasattr(b, "text")]

        if response.stop_reason == "end_turn":
            return "\n".join(text_parts)

        if response.stop_reason == "tool_use":
            messages.append({"role": "assistant", "content": response.content})
            tool_results = [
                {"type": "tool_result", "tool_use_id": b.id, "content": ""}
                for b in response.content
                if b.type == "tool_use"
            ]
            if tool_results:
                messages.append({"role": "user", "content": tool_results})
        else:
            return "\n".join(text_parts)

    return "\n".join(
        b.text for b in response.content if hasattr(b, "text")
    )


def _extract_json(text: str) -> dict:
    """Pull the first JSON object out of a text blob."""
    match = re.search(r'\{.*\}', text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass
    return {}


def _bool_str(val) -> str:
    """Normalize yes/no/true/false to a clean string."""
    if val is None:
        return ""
    s = str(val).lower().strip()
    if s in ("yes", "true", "1", "allowed", "permitted"):
        return "Yes"
    if s in ("no", "false", "0", "not allowed", "not permitted", "prohibited"):
        return "No"
    return str(val)


# ── Individual research functions ────────────────────────────────────────────

def research_zoning(county: str, state: str, apn: str, subdivision: str) -> dict:
    loc = f"{subdivision} {county} County {state}".strip()
    prompt = (
        f"Research zoning rules for this vacant land: {loc}, APN {apn}.\n\n"
        "Return ONLY a JSON object (no markdown) with these keys:\n"
        "zoning_designation, zoning_code, permitted_uses_summary, "
        "camping_allowed, rv_while_building, fulltime_rv_living, tent_camping, "
        "hunting_allowed, manufactured_homes, modular_homes, single_family_homes, "
        "tiny_home_friendly, hoa_poa, setbacks_summary, time_limit_to_build, "
        "building_permit_notes. "
        "Use 'Yes', 'No', or describe in plain text. "
        "If you cannot confirm a value with confidence, use null."
    )
    raw = run_web_search(prompt)
    logger.info("Zoning research raw: %s", raw[:300])
    return _extract_json(raw)


def research_utilities(county: str, state: str, subdivision: str) -> dict:
    loc = f"{subdivision} {county} County {state}".strip()
    prompt = (
        f"Research utility availability for vacant land in {loc}.\n\n"
        "Return ONLY a JSON object with these keys:\n"
        "well_required, well_allowed, septic_required, septic_install_allowed, "
        "electricity_available, electricity_provider, electricity_notes, "
        "gas_available, propane_allowed, solar_allowed, trash_service. "
        "Use 'Yes', 'No', provider name, or plain text description. "
        "If you cannot confirm a value, use null."
    )
    raw = run_web_search(prompt)
    logger.info("Utilities research raw: %s", raw[:300])
    return _extract_json(raw)


def research_flood_zone(county: str, state: str, subdivision: str, apn: str) -> dict:
    loc = f"{subdivision} {county} County {state}".strip()
    prompt = (
        f"Find the FEMA flood zone designation for vacant land in {loc}, APN {apn}.\n\n"
        "Return ONLY a JSON object with these keys:\n"
        "flood_zone_designation, flood_risk_level, flood_notes. "
        "Zone X = minimal risk. Zone A or AE = high risk (flag this clearly). "
        "If no designation found, return null for flood_zone_designation."
    )
    raw = run_web_search(prompt)
    logger.info("Flood zone research raw: %s", raw[:300])
    return _extract_json(raw)


def research_county_contacts(county: str, state: str) -> dict:
    prompt = (
        f"Find official contact information for {county} County {state} government offices.\n\n"
        "Return ONLY a JSON object with this structure:\n"
        '{"contacts": [{"department": "...", "website": "...", "phone": "..."}]}\n\n'
        "Include these departments: Assessor, Treasurer/Tax Collector, Recorder/Clerk, "
        "Planning and Zoning, GIS. "
        "Only include confirmed phone numbers and official .gov or .us websites."
    )
    raw = run_web_search(prompt)
    logger.info("County contacts raw: %s", raw[:300])
    parsed = _extract_json(raw)
    return parsed if parsed else {"contacts": []}


def research_location(county: str, state: str, subdivision: str) -> dict:
    loc = f"{subdivision} {county} County {state}".strip()
    prompt = (
        f"Research location highlights and nearby amenities for vacant land in {loc}.\n\n"
        "Return ONLY a JSON object with these keys:\n"
        "nearest_major_city, nearest_major_city_miles, nearest_small_town, "
        "nearest_small_town_miles, nearby_attractions, nearest_hospital, "
        "nearest_school_district, nearest_grocery. "
        "Express distances in miles as numbers. "
        "If you cannot confirm a value, use null."
    )
    raw = run_web_search(prompt)
    logger.info("Location research raw: %s", raw[:300])
    return _extract_json(raw)


def research_elevation_terrain(county: str, state: str, subdivision: str) -> dict:
    loc = f"{subdivision} {county} County {state}".strip()
    prompt = (
        f"Find the elevation and terrain description for vacant land in {loc}.\n\n"
        "Return ONLY a JSON object with these keys:\n"
        "elevation_feet, terrain_description. "
        "Elevation should be a number (feet above sea level). "
        "Terrain should be a short phrase like 'flat desert', 'rolling hills', 'forested mountain'. "
        "If you cannot confirm, use null."
    )
    raw = run_web_search(prompt)
    logger.info("Elevation research raw: %s", raw[:300])
    return _extract_json(raw)


def research_road_access(county: str, state: str, subdivision: str, apn: str) -> dict:
    loc = f"{subdivision} {county} County {state}".strip()
    prompt = (
        f"Research road access for vacant land in {loc}, APN {apn}.\n\n"
        "Return ONLY a JSON object with these keys:\n"
        "road_type, nearest_highway, legal_access_status, access_notes. "
        "road_type: 'Paved', 'Dirt/Gravel', 'Unknown'. "
        "legal_access_status: 'Confirmed', 'Easement Required', 'No Access', 'Unknown'. "
        "If you cannot confirm, use null."
    )
    raw = run_web_search(prompt)
    logger.info("Road access research raw: %s", raw[:300])
    return _extract_json(raw)


def research_all(county: str, state: str, apn: str, subdivision: str) -> dict:
    """Run all research modules and return combined dict."""
    results = {}

    for label, fn, args in [
        ("zoning",    research_zoning,           (county, state, apn, subdivision)),
        ("utilities", research_utilities,         (county, state, subdivision)),
        ("flood",     research_flood_zone,        (county, state, subdivision, apn)),
        ("contacts",  research_county_contacts,   (county, state)),
        ("location",  research_location,          (county, state, subdivision)),
        ("elevation", research_elevation_terrain, (county, state, subdivision)),
        ("access",    research_road_access,       (county, state, subdivision, apn)),
    ]:
        try:
            results[label] = fn(*args)
            logger.info("Research '%s' complete", label)
        except Exception as exc:
            logger.error("Research '%s' failed: %s", label, exc)
            results[label] = {}

    return results
