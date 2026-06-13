# DDR Web App — Frontend Spec

## Context

The full pipeline is already built and working. All research, scraping, comp search, PDF generation,
Google Drive upload, and Airtable write-back logic lives in the existing files. This spec covers
only what needs to be added to turn it into a web app with a form UI.

## What to build

### 1. `main.py` — add two endpoints

**`GET /`**
Serve a minimal HTML form page (embed HTML directly in the FastAPI response — no template engine needed).

**`POST /generate`**
Accept form data, find or create the Airtable record, run the pipeline, return result.

```python
@app.get("/")
async def form():
    return HTMLResponse(content=HTML_FORM)

@app.post("/generate")
async def generate(
    apn: str = Form(...),
    county: str = Form(...),
    state: str = Form(...),
    owner_name: str = Form(""),
    size: str = Form(""),
    subdivision: str = Form(""),
    drive_folder_id: str = Form(""),
):
    # 1. find_or_create_record() in airtable.py
    # 2. run_pipeline(record_id, test_mode=False)
    # 3. Return HTML response with PDF download link + Airtable record link
```

The `/generate` endpoint should run the pipeline **synchronously** (not as a BackgroundTask)
so the page can show the result when it's done. Pipeline takes 2-4 minutes — that's fine,
the browser will wait with a loading spinner.

### 2. `airtable.py` — add `find_or_create_record()`

```python
def find_or_create_record(apn: str, county: str, state: str,
                           owner_name: str = "", size: str = "",
                           subdivision: str = "", drive_folder_id: str = "") -> str:
    """
    Search for an existing record by APN. If found, update it with any
    new form data and set Status to 'Due Diligence'. If not found, create
    a new record. Returns the record ID either way.
    """
```

Use the Airtable Search API:
```
GET https://api.airtable.com/v0/{BASE_ID}/{TABLE_ID}
  ?filterByFormula=({fldSmkSyNu8wlNPNI}="R258820")
```

If a record is found, PATCH it. If not, POST to create it.
When creating, set Status field (fldGyOzIt4qLKmDzZ) to "Due Diligence".

### 3. HTML form (embed in `main.py` as a string constant)

**Fields:**
- APN (text input, required)
- County (dropdown, required):
  - Luna — NM
  - Klamath — OR
  - Putnam — FL
- Owner Name (text input, optional)
- Size in acres (number input, optional)
- Subdivision (text input, optional)
- Drive Folder ID (text input, optional — pre-fill from DEFAULT_DRIVE_FOLDER_ID env var)

**Behavior:**
- On submit: show a full-page spinner with message "Running due diligence pipeline... this takes 2-4 minutes."
- On success: green banner — "Report complete." — with two buttons:
  - "Download PDF" (links to the Google Drive URL)
  - "View in Airtable" (links to the Airtable record)
- On error: red banner with the error message

**Style:** Minimal, clean. White background, dark text, one centered card.
No external CSS frameworks — inline styles only so there are zero dependencies.
Dark green (#1B4332) for the submit button to match the PDF brand.

---

## New environment variable

Add to `.env.example` and Railway:

```
DEFAULT_DRIVE_FOLDER_ID=your_google_drive_folder_id_here
```

Used to pre-fill the Drive Folder ID field on the form so it doesn't need to be
typed every time. The user can override it per-property if needed.

---

## Hosting and subdomain

The code already lives in `apps/agents/ddr-automation/` and is pushed to
`github.com/tylerqbush/homelab`. Railway is already configured to deploy from
that subdirectory via `railway.toml`.

**To connect a subdomain after Railway is running:**
1. Railway dashboard → your service → Settings → Networking → Custom Domain
2. Add your subdomain (e.g. `ddr.yourdomain.com`)
3. Railway will show you a CNAME target
4. In your DNS provider: add a CNAME record — `ddr` pointing to that Railway URL
5. Takes ~5 minutes to propagate

---

## Files to touch

| File | Change |
|---|---|
| `main.py` | Add `GET /` and `POST /generate` endpoints + HTML_FORM constant |
| `airtable.py` | Add `find_or_create_record()` function |
| `.env.example` | Add `DEFAULT_DRIVE_FOLDER_ID` |

Everything else (pipeline, PDF, Drive, research, comps, pricing) is untouched.

---

## What NOT to change

- `pipeline.py` — no changes needed
- `pdf_generator.py` — no changes needed
- `research.py`, `comps.py`, `pricing.py`, `recommendation.py` — no changes needed
- `parcel_scraper.py` — no changes needed
- `drive_uploader.py` — no changes needed
- `railway.toml`, `Procfile`, `requirements.txt` — no changes needed
