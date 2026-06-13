# DDR Frontend Design — 2026-06-13

## What we're building

A web form that lets Tyler (or anyone with the link) submit a property APN and trigger the full due diligence pipeline. The form lives on Cloudflare Pages; the Python pipeline runs on Render.com.

## Architecture

```
Cloudflare Pages                     Render.com (free tier)
────────────────────                 ──────────────────────
tools/ddr/static/index.html   POST   tools/ddr/ (FastAPI)
ddr.landtolandholdings.com  ──────►  /generate
```

- Form page is a single static HTML file — no build step, no npm, no framework
- Python backend handles record lookup/create in Airtable, runs the pipeline, returns JSON
- Render free tier spins down after 15 min idle — first request after idle takes ~30s
- Users only see the Cloudflare subdomain; Render URL is internal

## Files changed

| File | Action |
|---|---|
| `tools/ddr/static/index.html` | CREATE |
| `tools/ddr/main.py` | MODIFY |
| `tools/ddr/airtable.py` | MODIFY |
| `tools/ddr/render.yaml` | CREATE |
| `tools/ddr/.env.example` | MODIFY |

Nothing else is touched.

## Form fields

| Field | Type | Required | Notes |
|---|---|---|---|
| State | select | Yes | NM / OR / FL — selecting auto-fills County |
| County | select | Yes | Auto-filled from State, read-only for now |
| APN | text | Yes | |
| Owner Name | text | No | |
| Size (acres) | number | No | |
| Subdivision | text | No | |
| Drive Folder ID | text | No | Pre-filled from `DEFAULT_DRIVE_FOLDER_ID` JS constant |

County is currently 1:1 with State (Luna/NM, Klamath/OR, Putnam/FL). When more counties are added, the State→County mapping in JS gets expanded — no backend changes needed.

## Submit behavior

1. Validate State, County, APN are filled — inline error if not
2. Disable submit button, show full-card spinner: "Running due diligence pipeline... this takes 2-4 minutes. Do not close this tab."
3. POST to `BACKEND_URL + /generate` as `application/x-www-form-urlencoded`
4. If no response after 40s: show "Still working — Render is warming up, this is normal..." below spinner without failing or retrying
5. On success (JSON `status: "complete"`): replace form with green result card showing:
   - "Report complete for [APN]"
   - "Download PDF" button linking to `pdf_url`
   - "View in Airtable" button linking to `record_url`
   - "Run another report" link that reloads the page
6. On error (non-200 or `status: "error"`): red card with `message` field + "Try again" link

## Style

- White background, one centered card, max-width 480px
- Primary color: dark green `#1B4332`
- Font: `system-ui`
- Inline styles only — zero external dependencies
- Mobile-first

## Backend changes

### main.py

- Remove `GET /` endpoint (doesn't exist in current code — nothing to remove)
- Add CORS middleware reading `FRONTEND_URL` env var (falls back to `"*"`)
- Add `POST /generate` endpoint: synchronous (not BackgroundTask), accepts form fields, calls `find_or_create_record()`, runs pipeline, fetches updated record, returns JSON with `pdf_url`, `record_url`, `apn`
- Import `find_or_create_record` from `airtable`

### airtable.py

Add `find_or_create_record(apn, county, state, owner_name, size, subdivision, drive_folder_id)`:
- Search by APN using `filterByFormula`
- If found: PATCH the record with provided fields
- If not found: POST a new record
- Always sets `F_STATUS` to `"Due Diligence"`
- Returns `(record_id, airtable_record_url)`

`owner_name` is accepted but not written to Airtable (no field mapping exists yet).

### render.yaml

Render.com web service config pointing at `tools/ddr/`. Build command installs Python deps + Playwright/Chromium. Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`. Health check at `/health`.

### .env.example

Add two vars:
- `DEFAULT_DRIVE_FOLDER_ID` — Google Drive folder where PDFs land
- `FRONTEND_URL` — Cloudflare Pages URL, used to lock down CORS

## Config constants in index.html

```js
const BACKEND_URL = "https://your-render-url.onrender.com"; // set before deploy
const DEFAULT_DRIVE_FOLDER_ID = ""; // set to your Google Drive folder ID
```

Both are set manually before deploying to Cloudflare Pages.
