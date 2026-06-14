import os
import logging
import requests

logger = logging.getLogger(__name__)

BASE_ID = os.environ.get("AIRTABLE_BASE_ID", "appE5El6Tgi6LS2Z6")
TABLE_ID = "tblIXORnaELK4K4w8"
API_URL = f"https://api.airtable.com/v0/{BASE_ID}/{TABLE_ID}"

# ── Input field IDs ──────────────────────────────────────────────────────────
F_APN = "fldSmkSyNu8wlNPNI"
F_STATE = "fldN6dWH9UzlAWo3M"
F_COUNTY = "fldNa7VH7kTgmfSnN"
F_SUBDIVISION = "fldBFjVd7MPrlwgaW"
F_SIZE = "fldCLtCkLfnJwxkNl"
F_DRIVE_FOLDER_ID = "fldiTfbUQz0OVRLm7"
F_STATUS = "fldGyOzIt4qLKmDzZ"

# ── Output field IDs ─────────────────────────────────────────────────────────
F_DD_RAW_JSON = "fldLLn4NRmucTNQoh"
F_PROPERTY_DECISION = "fldpkhwbFaOHFqOAN"
F_DECISION_REASONING = "fldPhE92R9Y5PAGHi"
F_RECOMMENDED_ACQ_PRICE = "fldxArZGTXeTB0kCI"
F_CASH_PURCHASE_PRICE = "fldWa27h5W11nVh1d"
F_EST_DAYS_TO_SELL = "fldmfKTRy9cGOCCOy"
F_COMP_SUMMARY = "fldsrb7ZCUHT21tX8"
F_COMP_URLS = "fldGBDO4G52JFZzHd"
F_RED_FLAGS = "fldc2UaI50zKyd8FF"
F_DD_EXTRACTED = "fldA5nshQpqzT3Liu"
F_ANNUAL_TAXES = "fldlJp4W00wKPRObp"
F_ACCESS = "fldeR6VNBorQc0IE5"
F_LEGAL_ACCESS = "fldWAXLwcKUY8EOYR"
F_MOBILE_HOME = "fldJhAktp27kNeZtW"
F_HOA = "fldz5GzoCtuUz9k1Q"
F_ZONING = "fld4O33TAX1XPljyb"
F_GPS = "fldj9dKEIxSnrpDXa"
F_FULL_LEGAL = "fldWHs7qSS6acHjaq"
F_SHORT_LEGAL = "fld76wMrV2riBwxY3"
F_ELEVATION = "fldyo0rCK5A1FESdh"
F_TERRAIN = "fld6KbD0X9fRtLN2U"
F_LOT_DIMENSIONS = "fldOFjVgsvTftBMQ4"
F_TIME_TO_BUILD = "fldUfgf7KR2x1BRdQ"
F_ZONING_DESIGNATION = "fldzWRUtCevU4OAK6"
F_SFH = "fldMUPfGBAZyam93u"
F_MODULAR = "fldGCXU52wjnUwtGd"
F_MANUFACTURED = "fldqMOWG8sslT3Mdb"
F_TINY_HOME = "fld5193iXuef6A5gM"
F_SEPTIC_REQ = "fldM2DFIjeeq9Eisi"
F_DRIVEWAY_REQ = "fldpmTERgPcGnUzOo"
F_FLOOD_PLAIN = "fldxnsvVsEQ5IKIyE"
F_RV_FULLTIME = "fldzUMLhTctBaIUnY"
F_RV_WHILE_BUILD = "fldqxjzidhBjSdfZd"
F_TENT_CAMPING = "fldoNw5tWHTzdEOOe"
F_HUNTING = "fldrv1wCoQFVKE90P"
F_WELL = "flduyI6Epr4KFWE8C"
F_SEPTIC_INSTALL = "fldMWxtk5wWJn2se1"
F_ELECTRICITY = "fld9PyUElUycXrGG4"
F_SOLAR = "fld5n4YtHRYWnXEy2"
F_PROPANE = "fldEfOuA7GOdKlCV2"
F_RV_CAMPING = "fldEQ0LbyGZt4NlyF"
F_GAS = "fld8A1BCocjXDmykf"
F_NEARBY_CITY = "fldZSus1xYbrDQvt5"
F_DRIVE_FOLDER_LINK = "fldnXQ2yJuuWsWHDt"


def _headers() -> dict:
    token = os.environ.get("AIRTABLE_API_KEY") or os.environ.get("AIRTABLE_TOKEN")
    if not token:
        raise ValueError("AIRTABLE_API_KEY env var not set")
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def get_record(record_id: str) -> dict:
    """Fetch a single record by ID and return the fields dict."""
    url = f"{API_URL}/{record_id}"
    resp = requests.get(url, headers=_headers(), timeout=30)
    resp.raise_for_status()
    data = resp.json()
    return data.get("fields", {})


def update_record(record_id: str, fields: dict) -> dict:
    """PATCH a record with the given field ID -> value mapping."""
    url = f"{API_URL}/{record_id}"
    payload = {"fields": fields}
    resp = requests.patch(url, headers=_headers(), json=payload, timeout=30)
    if not resp.ok:
        logger.error("Airtable update failed %s: %s", resp.status_code, resp.text)
    resp.raise_for_status()
    return resp.json()


def find_or_create_record(
    apn: str,
    county: str,
    state: str,
    owner_name: str = "",
    size: str = "",
    subdivision: str = "",
    drive_folder_id: str = "",
) -> tuple[str, str]:
    """Find an existing record by APN or create a new one. Returns (record_id, record_url)."""
    params = {"filterByFormula": f'({{{F_APN}}}="{apn}")'}
    resp = requests.get(API_URL, headers=_headers(), params=params, timeout=30)
    resp.raise_for_status()
    records = resp.json().get("records", [])

    fields_payload: dict = {
        F_APN: apn,
        F_STATE: state,
        F_COUNTY: county,
    }
    if size:
        try:
            fields_payload[F_SIZE] = float(size)
        except ValueError:
            pass
    if subdivision:
        fields_payload[F_SUBDIVISION] = subdivision
    if drive_folder_id:
        fields_payload[F_DRIVE_FOLDER_ID] = drive_folder_id

    if records:
        record_id = records[0]["id"]
        patch_resp = requests.patch(
            f"{API_URL}/{record_id}",
            headers=_headers(),
            json={"fields": fields_payload},
            timeout=30,
        )
        if not patch_resp.ok:
            logger.error("Airtable PATCH failed %s: %s", patch_resp.status_code, patch_resp.text)
        patch_resp.raise_for_status()
    else:
        post_resp = requests.post(
            API_URL,
            headers=_headers(),
            json={"fields": fields_payload},
            timeout=30,
        )
        post_resp.raise_for_status()
        record_id = post_resp.json()["id"]

    record_url = f"https://airtable.com/{BASE_ID}/{TABLE_ID}/{record_id}"
    return record_id, record_url
