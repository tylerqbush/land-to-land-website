# DDR Web App — Frontend Spec (Updated)

## Architecture

This tool uses a **split deployment** because Cloudflare Pages can only serve static files
and JavaScript — it cannot run Python.

```
Cloudflare Pages                    Render.com (free tier)
────────────────────                ──────────────────────
tools/ddr/static/index.html   →     tools/ddr/ (FastAPI + pipeline)
Served at: ddr.yourdomain.com  POST /generate
```

- The **form page** is a static HTML file hosted on Cloudflare Pages
- The **Python pipeline** runs on Render.com (free, no credit card required)
- Users only ever see the Cloudflare subdomain — the Render URL is internal
- Render's free tier spins down after 15 min of inactivity — first request after idle
  takes ~30 seconds. Show a "warming up" message to the user during this time.

---

## Files to create or modify

| File | Action | Notes |
|---|---|---|
| `tools/ddr/static/index.html` | CREATE | Standalone form page for Cloudflare Pages |
| `tools/ddr/main.py` | MODIFY | Remove `GET /`, add CORS middleware |
| `tools/ddr/airtable.py` | MODIFY | Add `find_or_create_record()` |
| `tools/ddr/render.yaml` | CREATE | Render.com deployment config |
| `tools/ddr/.env.example` | MODIFY | Add `DEFAULT_DRIVE_FOLDER_ID`, `FRONTEND_URL` |

Everything else (pipeline, PDF, Drive, research, comps, pricing) is untouched.

---

## 1. `tools/ddr/static/index.html`

A single standalone HTML file. No build step, no framework, no npm.
Deployed to Cloudflare Pages as a static site.

**Form fields:**

| Field | Type | Required | Notes |
|---|---|---|---|
| APN | text | Yes | |
| County | select | Yes | Options: Luna — NM / Klamath — OR / Putnam — FL |
| Owner Name | text | No | |
| Size (acres) | number | No | |
| Subdivision | text | No | |
| Drive Folder ID | text | No | Pre-filled via JS from a config constant at top of file |

**Submit behavior:**
1. Validate APN and County are filled
2. Disable button, show full-card spinner: "Running due diligence pipeline...
   this takes 2-4 minutes. Do not close this tab."
3. POST to `BACKEND_URL + /generate` as `application/x-www-form-urlencoded`
4. On success: replace form with green result card showing:
   - "Report complete for [APN]"
   - "Download PDF" button (links to Google Drive URL)
   - "View in Airtable" button (links to Airtable record URL)
   - "Run another report" link that reloads the page
5. On error: show red error card with the error message + "Try again" link
6. Handle slow cold-start: if no response after 40 seconds, show
   "Still working — Render is warming up, this is normal..." without failing

**Style:**
- White background, one centered card (max-width 480px)
- Dark green #1B4332 for primary button and accents
- Clean sans-serif (system-ui)
- Inline styles only — zero external dependencies
- Mobile friendly

**Config constants at top of script block:**
```js
const BACKEND_URL = "https://your-render-url.onrender.com"; // set before deploy
const DEFAULT_DRIVE_FOLDER_ID = ""; // set to your Google Drive folder ID
```

---

## 2. `tools/ddr/main.py` changes

Remove the `GET /` endpoint entirely.

Add CORS middleware so the Cloudflare Pages domain can call the API:

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.environ.get("FRONTEND_URL", "*")],
    allow_credentials=False,
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)
```

Change `POST /generate` to run the pipeline synchronously (not BackgroundTask)
and return JSON so the frontend can read the result:

```python
from fastapi import Form
from fastapi.responses import JSONResponse

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
    try:
        folder = drive_folder_id or os.environ.get("DEFAULT_DRIVE_FOLDER_ID", "")
        record_id, record_url = find_or_create_record(
            apn, county, state, owner_name, size, subdivision, folder
        )
        run_pipeline(record_id, test_mode=False)
        fields = at.get_record(record_id)
        pdf_url = fields.get(at.F_DRIVE_FOLDER_LINK, "")
        return JSONResponse({"status": "complete", "pdf_url": pdf_url,
                             "record_url": record_url, "apn": apn})
    except Exception as exc:
        return JSONResponse({"status": "error", "message": str(exc)},
                            status_code=500)
```

Import `find_or_create_record` from `airtable.py` at the top of `main.py`.

---

## 3. `tools/ddr/airtable.py` — add `find_or_create_record()`

```python
def find_or_create_record(apn, county, state, owner_name="",
                           size="", subdivision="", drive_folder_id=""):
    """
    Search for existing record by APN. Update if found, create if not.
    Returns (record_id, airtable_record_url).
    """
    params = {"filterByFormula": f'({{{F_APN}}}="{apn}")'}
    resp = requests.get(API_URL, headers=_headers(), params=params, timeout=30)
    resp.raise_for_status()
    records = resp.json().get("records", [])

    fields_payload = {
        F_APN: apn,
        F_STATE: state,
        F_COUNTY: county,
        F_STATUS: "Due Diligence",
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
        requests.patch(f"{API_URL}/{record_id}", headers=_headers(),
                       json={"fields": fields_payload}, timeout=30)
    else:
        resp2 = requests.post(API_URL, headers=_headers(),
                              json={"fields": fields_payload}, timeout=30)
        resp2.raise_for_status()
        record_id = resp2.json()["id"]

    record_url = f"https://airtable.com/{BASE_ID}/{TABLE_ID}/{record_id}"
    return record_id, record_url
```

---

## 4. `tools/ddr/render.yaml` (new file)

```yaml
services:
  - type: web
    name: ddr-automation
    runtime: python
    buildCommand: pip install -r requirements.txt && playwright install chromium && playwright install-deps chromium
    startCommand: uvicorn main:app --host 0.0.0.0 --port $PORT
    healthCheckPath: /health
    envVars:
      - key: ANTHROPIC_API_KEY
        sync: false
      - key: AIRTABLE_API_KEY
        sync: false
      - key: AIRTABLE_BASE_ID
        value: appE5El6Tgi6LS2Z6
      - key: GOOGLE_SERVICE_ACCOUNT_JSON
        sync: false
      - key: WEBHOOK_SECRET
        sync: false
      - key: DEFAULT_DRIVE_FOLDER_ID
        sync: false
      - key: FRONTEND_URL
        sync: false
```

---

## 5. `.env.example` additions

```
DEFAULT_DRIVE_FOLDER_ID=your_google_drive_folder_id_here
FRONTEND_URL=https://ddr.yourdomain.com
```

---

## Deployment sequence (after the code is built)

### Step 1 — Deploy backend to Render.com
1. Go to render.com — New — Web Service
2. Connect `tylerqbush/land-to-land-website` repo
3. Set Root Directory to `tools/ddr`
4. Render detects `render.yaml` automatically
5. Add the 6 env vars in Render dashboard
6. Deploy — first build takes ~5 min (Playwright installs Chromium)
7. Copy the Render URL (e.g. `https://ddr-automation.onrender.com`)

### Step 2 — Set BACKEND_URL in the frontend
Update `BACKEND_URL` constant in `tools/ddr/static/index.html` to the Render URL,
commit and push.

### Step 3 — Deploy frontend to Cloudflare Pages
1. Cloudflare dashboard — Pages — Create project
2. Connect `tylerqbush/land-to-land-website` repo
3. Build output directory: `tools/ddr/static`
4. No build command needed (pure static HTML)
5. Add custom domain: `ddr.yourdomain.com`

### Step 4 — Lock down CORS
Set `FRONTEND_URL` env var on Render to the Cloudflare Pages URL
(e.g. `https://ddr.landtolandholdings.com`).
