"""
Generate a property decision and reasoning using Claude.
Decision maps to exactly three Airtable single-select options.
"""

import json
import logging
import os
import re

import anthropic

logger = logging.getLogger(__name__)
MODEL = "claude-sonnet-4-6"


DECISION_OPTIONS = ("Accept and Close", "Decline", "Request Second-Opinion")

RED_FLAG_OPTIONS = ("Back Taxes", "Title Discrepancy", "No Access",
                    "Owner Deceased", "Other", "None")


def generate_recommendation(property_data: dict, research: dict,
                             comps: dict, pricing: dict) -> dict:
    """
    Returns:
      decision       — one of DECISION_OPTIONS
      reasoning      — 3-5 sentence paragraph
      red_flags      — list of RED_FLAG_OPTIONS values
      est_days_sell  — int
    """
    context = _build_context(property_data, research, comps, pricing)

    prompt = (
        "You are a land investment analyst for Land to Land Holdings LLC. "
        "We buy vacant land at 25-35% of median comp sold price and sell with owner financing.\n\n"
        f"PROPERTY SUMMARY:\n{context}\n\n"
        "Analyze this property and return ONLY a JSON object (no markdown) with these keys:\n"
        '{\n'
        '  "decision": "Accept and Close" | "Decline" | "Request Second-Opinion",\n'
        '  "reasoning": "3-5 sentence paragraph explaining the key factors",\n'
        '  "red_flags": ["Back Taxes"|"Title Discrepancy"|"No Access"|"Owner Deceased"|"Other"|"None"],\n'
        '  "est_days_sell": integer (estimated days to sell based on median comp DOM)\n'
        '}\n\n'
        "DECISION RULES:\n"
        "- 'Accept and Close': pricing math works, no disqualifying red flags, access confirmed, flood zone X or none\n"
        "- 'Decline': flood zone A/AE, no legal access, back taxes exceed 20% of acquisition price, "
        "title issues, OR asking price exceeds recommended acquisition price by more than 50%\n"
        "- 'Request Second-Opinion': borderline pricing, minor concerns, fewer than 3 comps, "
        "incomplete parcel data, or anything that makes you uncertain\n\n"
        "RED FLAG RULES:\n"
        "- 'Back Taxes': if any delinquent taxes found\n"
        "- 'No Access': if no confirmed legal road access\n"
        "- 'Title Discrepancy': if ownership conflict or probate issue found\n"
        "- 'Owner Deceased': if owner appears deceased\n"
        "- 'None': if no issues found\n"
        "- 'Other': anything else worth flagging\n\n"
        "Be conservative — when in doubt, use 'Request Second-Opinion' not 'Accept and Close'."
    )

    client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))
    response = client.messages.create(
        model=MODEL,
        max_tokens=2048,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = response.content[0].text if response.content else "{}"
    logger.info("Recommendation raw: %s", raw[:400])

    result = _parse_recommendation(raw, comps)
    return result


def _parse_recommendation(raw: str, comps: dict) -> dict:
    defaults = {
        "decision": "Request Second-Opinion",
        "reasoning": "Automated analysis could not complete — manual review required.",
        "red_flags": ["None"],
        "est_days_sell": int(comps.get("median_dom", 90)) or 90,
    }

    try:
        parsed = json.loads(re.search(r'\{.*\}', raw, re.DOTALL).group())
    except Exception:
        logger.warning("Could not parse recommendation JSON, using defaults")
        return defaults

    decision = parsed.get("decision", "").strip()
    if decision not in DECISION_OPTIONS:
        decision = "Request Second-Opinion"

    flags_raw = parsed.get("red_flags", ["None"])
    if isinstance(flags_raw, str):
        flags_raw = [flags_raw]
    red_flags = [f for f in flags_raw if f in RED_FLAG_OPTIONS]
    if not red_flags:
        red_flags = ["None"]

    est_days = parsed.get("est_days_sell")
    try:
        est_days = int(est_days)
    except (TypeError, ValueError):
        est_days = int(comps.get("median_dom", 90)) or 90

    return {
        "decision": decision,
        "reasoning": parsed.get("reasoning", defaults["reasoning"]),
        "red_flags": red_flags,
        "est_days_sell": est_days,
    }


def _build_context(property_data: dict, research: dict,
                   comps: dict, pricing: dict) -> str:
    zoning = research.get("zoning", {})
    flood = research.get("flood", {})
    access = research.get("access", {})
    parcel = property_data.get("parcel", {})

    lines = [
        f"APN: {property_data.get('apn', 'Unknown')}",
        f"County/State: {property_data.get('county', '')} {property_data.get('state', '')}",
        f"Size: {property_data.get('size', 'Unknown')} acres",
        f"Subdivision: {property_data.get('subdivision', 'N/A')}",
        "",
        f"Annual Taxes: {parcel.get('annual_taxes', 'Unknown')}",
        f"Assessed Value: {parcel.get('assessed_value', 'Unknown')}",
        f"Owner: {parcel.get('owner_name', 'Unknown')}",
        "",
        f"Flood Zone: {flood.get('flood_zone_designation', 'Unknown')} — {flood.get('flood_risk_level', '')}",
        f"Legal Access: {access.get('legal_access_status', 'Unknown')}",
        f"Road Type: {access.get('road_type', 'Unknown')}",
        "",
        f"Zoning: {zoning.get('zoning_designation', 'Unknown')}",
        f"HOA/POA: {zoning.get('hoa_poa', 'Unknown')}",
        "",
        f"Comp sample size: {comps.get('sample_size', 0)}",
        f"Median sold price: ${comps.get('median_price', 0):,.0f}",
        f"Median DOM: {comps.get('median_dom', 'Unknown')} days",
        f"Low confidence: {comps.get('low_confidence', False)}",
        "",
        f"Recommended acquisition price: {pricing.get('acquisition_price_display', 'N/A')}",
        f"Retail cash price: ${pricing.get('retail_cash_price', 0):,.0f}",
        f"Market: {pricing.get('market', 'Unknown')}",
    ]

    manual = parcel.get("manual_lookup_required", [])
    if manual:
        lines.append(f"\nFields requiring manual verification: {', '.join(manual)}")

    return "\n".join(lines)
