"""
Acquisition price and retail price calculations by market.

Luna NM / Klamath OR: offer = 25% of median comp sold price
Putnam FL:            offer range = 30%-35% of median comp sold price
Retail Cash Price     = median comp sold price (all markets)
"""


def calculate_pricing(county: str, state: str, median_comp_price: float) -> dict:
    """
    Returns:
      acquisition_price        — recommended single offer (NM/OR) or midpoint (FL)
      acquisition_price_display — formatted string (range for FL, single for others)
      retail_cash_price        — full retail cash price
      market                   — which market rule was applied
    """
    if median_comp_price <= 0:
        return {
            "acquisition_price": 0,
            "acquisition_price_display": "N/A — no comp data",
            "retail_cash_price": 0,
            "market": "unknown",
        }

    state_upper = state.upper()
    county_lower = county.lower()

    if "putnam" in county_lower and state_upper == "FL":
        low = _round_to_100(median_comp_price * 0.30)
        high = _round_to_100(median_comp_price * 0.35)
        midpoint = round((low + high) / 2, 2)
        return {
            "acquisition_price": midpoint,
            "acquisition_price_display": f"${low:,.0f} - ${high:,.0f}",
            "retail_cash_price": round(median_comp_price, 2),
            "market": "Putnam FL (30-35%)",
        }

    # Luna NM or Klamath OR — 25%
    offer = _round_to_100(median_comp_price * 0.25)
    return {
        "acquisition_price": offer,
        "acquisition_price_display": f"${offer:,.0f}",
        "retail_cash_price": round(median_comp_price, 2),
        "market": f"{county} {state} (25%)",
    }


def _round_to_100(value: float) -> float:
    return round(value / 100) * 100
