"""
Vacant land sold comps search, validation, and metrics calculation.
Searches Land.com, Landmodo, Zillow, and Redfin via Anthropic web_search.
Only accepts comps with NO structure indicators and a confirmed sold date + URL.
"""

import json
import logging
import re
from datetime import datetime, timedelta
from statistics import median
from typing import Optional

from research import run_web_search

logger = logging.getLogger(__name__)

STRUCTURE_KEYWORDS = [
    "house", "cabin", "home", "dwelling", "structure", "building",
    "manufactured", "mobile", "improvement", "barn", "shed", "garage",
    "residence", "residential", "sqft", "sq ft", "sq. ft", "bedroom",
    "bathroom", "bath", "bed", "living", "kitchen", "roof", "foundation",
    "construction", "remodel", "renovated",
]

VALID_LAND_PHRASES = [
    "vacant", "bare", "raw", "unimproved", "lot only", "land only",
    "acreage", "acres", "parcel", "lot", "vacant land", "bare land",
    "raw land", "undeveloped",
]


def _is_valid_comp(comp: dict) -> bool:
    """Return True only if the comp is confirmed vacant land with a URL and sold date."""
    desc = " ".join([
        str(comp.get("description", "")),
        str(comp.get("title", "")),
        str(comp.get("notes", "")),
    ]).lower()

    for kw in STRUCTURE_KEYWORDS:
        if kw in desc:
            logger.debug("Comp rejected — structure keyword '%s': %s", kw, comp.get("url", ""))
            return False

    if not any(ph in desc for ph in VALID_LAND_PHRASES):
        if not (comp.get("acreage") or comp.get("acres")):
            logger.debug("Comp rejected — no vacant land indicator: %s", comp.get("url", ""))
            return False

    if not comp.get("url"):
        logger.debug("Comp rejected — no URL")
        return False

    if not comp.get("sold_date") and not comp.get("sold_price"):
        logger.debug("Comp rejected — no confirmed sold info: %s", comp.get("url", ""))
        return False

    return True


def _parse_price(val) -> Optional[float]:
    if val is None:
        return None
    s = re.sub(r"[^\d.]", "", str(val))
    try:
        return float(s)
    except ValueError:
        return None


def _calculate_dom(list_date: str, sold_date: str) -> Optional[int]:
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%B %d, %Y", "%b %d, %Y", "%m-%d-%Y"):
        try:
            ld = datetime.strptime(list_date.strip(), fmt)
            sd = datetime.strptime(sold_date.strip(), fmt)
            return max(0, (sd - ld).days)
        except (ValueError, AttributeError):
            continue
    return None


def find_vacant_land_comps(county: str, state: str, subdivision: str,
                            acreage: str = "") -> dict:
    """
    Search for sold vacant land comps. Returns:
      {
        "comps": [...],
        "median_price": float,
        "median_price_per_acre": float,
        "median_dom": float,
        "sample_size": int,
        "low_confidence": bool,
        "warning": str or None
      }
    """
    loc = f"{subdivision} {county} County {state}".strip()
    size_hint = f" approximately {acreage} acres" if acreage else ""

    prompt = (
        f"Search for recently SOLD vacant land comps in {loc}{size_hint}. "
        f"I need properties sold within the last 18 months on Land.com, Landmodo, Zillow, and Redfin.\n\n"
        f"CRITICAL RULES:\n"
        f"- Vacant, bare, raw, unimproved land ONLY\n"
        f"- Absolutely NO structures of any kind (no houses, cabins, mobile homes, barns, sheds, etc.)\n"
        f"- Each comp MUST have a confirmed sold date (not just listed)\n"
        f"- Each comp MUST have a direct URL\n\n"
        f"Search these sites:\n"
        f'- site:land.com "sold" "{county}" "{state}" vacant land\n'
        f'- site:landmodo.com "sold" "{county}" "{state}" bare land\n'
        f'- site:zillow.com "sold" "{county}" "{state}" vacant lot -house -home\n'
        f'- site:redfin.com "sold" "{county}" "{state}" land unimproved\n\n'
        f"Return ONLY a JSON object:\n"
        '{"comps": [\n'
        '  {\n'
        '    "acreage": number,\n'
        '    "sold_price": number,\n'
        '    "price_per_acre": number,\n'
        '    "list_date": "YYYY-MM-DD or null",\n'
        '    "sold_date": "YYYY-MM-DD",\n'
        '    "dom": number or null,\n'
        '    "url": "direct URL",\n'
        '    "source": "land.com|landmodo|zillow|redfin",\n'
        '    "description": "brief land description (MUST say vacant/bare/raw/unimproved)",\n'
        '    "title": "listing title"\n'
        '  }\n'
        ']}'
    )

    raw = run_web_search(prompt)
    logger.info("Comps raw response (first 400 chars): %s", raw[:400])

    comps_raw = []
    try:
        parsed = json.loads(re.search(r'\{.*\}', raw, re.DOTALL).group())
        comps_raw = parsed.get("comps", [])
    except Exception as exc:
        logger.warning("Could not parse comps JSON: %s", exc)

    valid_comps = []
    for comp in comps_raw:
        if not _is_valid_comp(comp):
            continue

        price = _parse_price(comp.get("sold_price"))
        acreage_val = _parse_price(comp.get("acreage"))

        if not price or price <= 0:
            continue

        if acreage_val and acreage_val > 0 and not comp.get("price_per_acre"):
            comp["price_per_acre"] = round(price / acreage_val, 2)

        if comp.get("list_date") and comp.get("sold_date") and not comp.get("dom"):
            dom = _calculate_dom(comp["list_date"], comp["sold_date"])
            if dom is not None:
                comp["dom"] = dom

        comp["sold_price"] = price
        comp["acreage"] = acreage_val
        valid_comps.append(comp)

    sample_size = len(valid_comps)
    low_confidence = sample_size < 3
    warning = None

    if low_confidence:
        warning = (
            f"⚠️ LOW CONFIDENCE — Only {sample_size} valid vacant land comp(s) found "
            f"in {loc}. Pricing estimates may be unreliable. Consider manual comp research."
        )
        logger.warning(warning)

    prices = [c["sold_price"] for c in valid_comps if c.get("sold_price")]
    ppas = [c["price_per_acre"] for c in valid_comps
            if c.get("price_per_acre") and c["price_per_acre"] > 0]
    doms = [c["dom"] for c in valid_comps if c.get("dom") is not None]

    return {
        "comps": valid_comps,
        "median_price": median(prices) if prices else 0,
        "median_price_per_acre": median(ppas) if ppas else 0,
        "median_dom": median(doms) if doms else 0,
        "sample_size": sample_size,
        "low_confidence": low_confidence,
        "warning": warning,
    }
