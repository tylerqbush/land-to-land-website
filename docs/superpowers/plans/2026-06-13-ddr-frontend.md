# DDR Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire a static HTML form on Cloudflare Pages to the existing DDR FastAPI pipeline running on Render.com, so Tyler can submit a property APN and get a PDF + Airtable record back in the browser.

**Architecture:** Static HTML form (no build step) POSTs to FastAPI via `application/x-www-form-urlencoded`. FastAPI looks up or creates an Airtable record, runs the existing pipeline synchronously, and returns JSON with the PDF URL and Airtable record URL. CORS is locked to the Cloudflare Pages origin via env var.

**Tech Stack:** FastAPI, Python `requests`, vanilla JS (ES2020), Cloudflare Pages (static hosting), Render.com (Python web service)

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `tools/ddr/requirements.txt` | MODIFY | Add `python-multipart`, `pytest`, `httpx` |
| `tools/ddr/tests/conftest.py` | CREATE | Sys path + env var setup for all tests |
| `tools/ddr/tests/test_airtable.py` | CREATE | Unit tests for `find_or_create_record()` |
| `tools/ddr/tests/test_main.py` | CREATE | Integration tests for `POST /generate` |
| `tools/ddr/airtable.py` | MODIFY | Add `find_or_create_record()` |
| `tools/ddr/main.py` | MODIFY | Add CORS middleware + `POST /generate` endpoint |
| `tools/ddr/render.yaml` | CREATE | Render.com deployment config |
| `tools/ddr/.env.example` | MODIFY | Add `DEFAULT_DRIVE_FOLDER_ID` and `FRONTEND_URL` |
| `tools/ddr/static/index.html` | CREATE | Standalone HTML form for Cloudflare Pages |

---

## Task 1: Add test dependencies and test infrastructure

**Files:**
- Modify: `tools/ddr/requirements.txt`
- Create: `tools/ddr/tests/__init__.py`
- Create: `tools/ddr/tests/conftest.py`

`python-multipart` is required for FastAPI to parse `Form(...)` fields — without it, every form POST returns a 422. `httpx` is required by FastAPI's TestClient. `pytest` is the test runner.

- [ ] **Step 1: Add dependencies to requirements.txt**

Open `tools/ddr/requirements.txt` and append these three lines at the bottom:

```
python-multipart==0.0.19
pytest==8.3.4
httpx==0.28.1
```

- [ ] **Step 2: Create tests package**

Create `tools/ddr/tests/__init__.py` (empty file).

- [ ] **Step 3: Create conftest.py**

Create `tools/ddr/tests/conftest.py`:

```python
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

os.environ.setdefault("AIRTABLE_API_KEY", "test-key")
os.environ.setdefault("ANTHROPIC_API_KEY", "sk-ant-test")
os.environ.setdefault("AIRTABLE_BASE_ID", "appE5El6Tgi6LS2Z6")
```

- [ ] **Step 4: Install new dependencies**

Run from `tools/ddr/`:

```bash
pip install python-multipart==0.0.19 pytest==8.3.4 httpx==0.28.1
```

Expected: three packages install without errors.

- [ ] **Step 5: Commit**

```bash
git add tools/ddr/requirements.txt tools/ddr/tests/
git commit -m "test: add test infrastructure and dependencies"
```

---

## Task 2: Add find_or_create_record() to airtable.py (TDD)

**Files:**
- Create: `tools/ddr/tests/test_airtable.py`
- Modify: `tools/ddr/airtable.py`

- [ ] **Step 1: Write failing tests**

Create `tools/ddr/tests/test_airtable.py`:

```python
import os
from unittest.mock import patch, MagicMock
import airtable as at


def _env():
    return {"AIRTABLE_API_KEY": "test-key"}


@patch("airtable.requests.get")
@patch("airtable.requests.post")
def test_creates_new_record_when_apn_not_found(mock_post, mock_get):
    mock_get.return_value.raise_for_status = lambda: None
    mock_get.return_value.json.return_value = {"records": []}
    mock_post.return_value.raise_for_status = lambda: None
    mock_post.return_value.json.return_value = {"id": "recNEW123"}

    with patch.dict(os.environ, _env()):
        record_id, record_url = at.find_or_create_record("APN-001", "Luna", "NM")

    assert record_id == "recNEW123"
    assert "recNEW123" in record_url
    mock_post.assert_called_once()
    fields = mock_post.call_args[1]["json"]["fields"]
    assert fields[at.F_APN] == "APN-001"
    assert fields[at.F_COUNTY] == "Luna"
    assert fields[at.F_STATE] == "NM"


@patch("airtable.requests.get")
@patch("airtable.requests.patch")
def test_patches_existing_record_when_apn_found(mock_patch, mock_get):
    mock_get.return_value.raise_for_status = lambda: None
    mock_get.return_value.json.return_value = {"records": [{"id": "recEXIST456"}]}
    mock_patch.return_value = MagicMock(ok=True)

    with patch.dict(os.environ, _env()):
        record_id, record_url = at.find_or_create_record("APN-001", "Luna", "NM")

    assert record_id == "recEXIST456"
    assert "recEXIST456" in record_url
    mock_patch.assert_called_once()


@patch("airtable.requests.get")
@patch("airtable.requests.post")
def test_converts_size_string_to_float(mock_post, mock_get):
    mock_get.return_value.raise_for_status = lambda: None
    mock_get.return_value.json.return_value = {"records": []}
    mock_post.return_value.raise_for_status = lambda: None
    mock_post.return_value.json.return_value = {"id": "recABC"}

    with patch.dict(os.environ, _env()):
        at.find_or_create_record("APN-001", "Luna", "NM", size="5.5")

    fields = mock_post.call_args[1]["json"]["fields"]
    assert fields[at.F_SIZE] == 5.5


@patch("airtable.requests.get")
@patch("airtable.requests.post")
def test_omits_size_field_when_size_empty(mock_post, mock_get):
    mock_get.return_value.raise_for_status = lambda: None
    mock_get.return_value.json.return_value = {"records": []}
    mock_post.return_value.raise_for_status = lambda: None
    mock_post.return_value.json.return_value = {"id": "recABC"}

    with patch.dict(os.environ, _env()):
        at.find_or_create_record("APN-001", "Luna", "NM", size="")

    fields = mock_post.call_args[1]["json"]["fields"]
    assert at.F_SIZE not in fields
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd tools/ddr && pytest tests/test_airtable.py -v
```

Expected: `AttributeError: module 'airtable' has no attribute 'find_or_create_record'`

- [ ] **Step 3: Implement find_or_create_record() in airtable.py**

Append to `tools/ddr/airtable.py`:

```python
def find_or_create_record(apn, county, state, owner_name="",
                           size="", subdivision="", drive_folder_id=""):
    """
    Search for existing record by APN. Update if found, create if not.
    Returns (record_id, airtable_record_url).

    NOTE: F_STATUS value "Due Diligence" must match Airtable's select option
    exactly. Airtable stores some status values with trailing spaces
    (per CLAUDE.md). If records reject this value, check the exact option
    name in the Airtable UI and update accordingly.
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

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd tools/ddr && pytest tests/test_airtable.py -v
```

Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/ddr/tests/test_airtable.py tools/ddr/airtable.py
git commit -m "feat: add find_or_create_record() to airtable.py"
```

---

## Task 3: Update main.py — CORS and /generate endpoint (TDD)

**Files:**
- Create: `tools/ddr/tests/test_main.py`
- Modify: `tools/ddr/main.py`

- [ ] **Step 1: Write failing tests**

Create `tools/ddr/tests/test_main.py`:

```python
from unittest.mock import patch
from fastapi.testclient import TestClient
import main
import airtable as at

client = TestClient(main.app)


def test_generate_returns_complete_on_success():
    with patch.object(main, "find_or_create_record",
                      return_value=("recABC", "https://airtable.com/app/tbl/recABC")), \
         patch.object(main, "run_pipeline"), \
         patch.object(main.at, "get_record",
                      return_value={at.F_DRIVE_FOLDER_LINK: "https://drive.google.com/pdf"}):

        resp = client.post("/generate", data={
            "apn": "R258820",
            "county": "Klamath",
            "state": "OR",
        })

    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "complete"
    assert data["apn"] == "R258820"
    assert data["pdf_url"] == "https://drive.google.com/pdf"
    assert "recABC" in data["record_url"]


def test_generate_returns_error_when_pipeline_raises():
    with patch.object(main, "find_or_create_record",
                      return_value=("recABC", "https://airtable.com/app/tbl/recABC")), \
         patch.object(main, "run_pipeline",
                      side_effect=RuntimeError("pipeline blew up")):

        resp = client.post("/generate", data={
            "apn": "R258820",
            "county": "Klamath",
            "state": "OR",
        })

    assert resp.status_code == 500
    data = resp.json()
    assert data["status"] == "error"
    assert "pipeline blew up" in data["message"]


def test_generate_returns_error_when_airtable_raises():
    with patch.object(main, "find_or_create_record",
                      side_effect=ValueError("Airtable API key not set")):

        resp = client.post("/generate", data={
            "apn": "R258820",
            "county": "Klamath",
            "state": "OR",
        })

    assert resp.status_code == 500
    assert resp.json()["status"] == "error"


def test_health_endpoint_unaffected():
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd tools/ddr && pytest tests/test_main.py -v
```

Expected: `AttributeError: module 'main' has no attribute 'find_or_create_record'` (or similar — the /generate route does not exist yet).

- [ ] **Step 3: Update main.py**

Replace the entire contents of `tools/ddr/main.py` with:

```python
import os
import logging
import hmac

from fastapi import FastAPI, Request, HTTPException, BackgroundTasks, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

import airtable as at
from airtable import find_or_create_record
from pipeline import run_pipeline

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(title="DDR Automation", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.environ.get("FRONTEND_URL", "*")],
    allow_credentials=False,
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

WEBHOOK_SECRET = os.environ.get("WEBHOOK_SECRET", "")


def _verify_secret(provided: str) -> bool:
    if not WEBHOOK_SECRET:
        return True
    return hmac.compare_digest(WEBHOOK_SECRET, provided)


@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}


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
        logger.exception("Pipeline failed for APN %s", apn)
        return JSONResponse({"status": "error", "message": str(exc)},
                            status_code=500)


@app.post("/webhook")
async def webhook(request: Request, background_tasks: BackgroundTasks):
    secret = request.headers.get("X-Webhook-Secret", "")
    if not _verify_secret(secret):
        logger.warning("Webhook received with invalid secret")
        raise HTTPException(status_code=401, detail="Invalid webhook secret")

    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    record_id = (
        payload.get("record_id")
        or payload.get("recordId")
        or (payload.get("record", {}) or {}).get("id")
    )
    if not record_id:
        logger.warning("Webhook payload missing record_id: %s", payload)
        raise HTTPException(status_code=400, detail="Missing record_id in payload")

    logger.info("Webhook accepted for record %s — launching pipeline", record_id)
    background_tasks.add_task(run_pipeline, record_id, test_mode=False)
    return JSONResponse(content={"status": "accepted", "record_id": record_id})


@app.post("/test")
async def test_pipeline(background_tasks: BackgroundTasks):
    """Run pipeline with a synthetic test property (OR-Klamath-R258820)."""
    logger.info("Test pipeline triggered")
    background_tasks.add_task(run_pipeline, "TEST_RECORD", test_mode=True)
    return JSONResponse(
        content={
            "status": "test pipeline started",
            "test_property": "OR-Klamath-R258820",
            "note": "Results will be logged but NOT written back to Airtable.",
        }
    )
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd tools/ddr && pytest tests/test_main.py -v
```

Expected: 4 tests PASS.

- [ ] **Step 5: Run all tests together**

```bash
cd tools/ddr && pytest tests/ -v
```

Expected: 8 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add tools/ddr/tests/test_main.py tools/ddr/main.py
git commit -m "feat: add CORS middleware and POST /generate endpoint to main.py"
```

---

## Task 4: Create render.yaml

**Files:**
- Create: `tools/ddr/render.yaml`

No tests needed — this is a deployment config file.

- [ ] **Step 1: Create render.yaml**

Create `tools/ddr/render.yaml`:

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

- [ ] **Step 2: Commit**

```bash
git add tools/ddr/render.yaml
git commit -m "feat: add render.yaml for Render.com deployment"
```

---

## Task 5: Update .env.example

**Files:**
- Modify: `tools/ddr/.env.example`

- [ ] **Step 1: Add the two new vars**

Append to `tools/ddr/.env.example`:

```
# New in frontend build
DEFAULT_DRIVE_FOLDER_ID=your_google_drive_folder_id_here
FRONTEND_URL=https://ddr.yourdomain.com
```

- [ ] **Step 2: Commit**

```bash
git add tools/ddr/.env.example
git commit -m "docs: add DEFAULT_DRIVE_FOLDER_ID and FRONTEND_URL to .env.example"
```

---

## Task 6: Create static/index.html

**Files:**
- Create: `tools/ddr/static/index.html`

No automated tests — verify manually by opening in a browser (see Step 2).

- [ ] **Step 1: Create the file**

Create `tools/ddr/static/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Due Diligence Report</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
      background: #f3f4f6;
      min-height: 100vh;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding: 32px 16px;
    }
    .card {
      background: #fff;
      border-radius: 12px;
      padding: 32px;
      max-width: 480px;
      width: 100%;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.06);
    }
    .card-title { font-size: 1.25rem; font-weight: 700; color: #1B4332; margin-bottom: 4px; }
    .card-sub { font-size: 0.875rem; color: #6b7280; margin-bottom: 24px; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .field { margin-bottom: 16px; }
    .field label {
      display: block; font-size: 0.75rem; font-weight: 600;
      color: #374151; margin-bottom: 4px;
      text-transform: uppercase; letter-spacing: 0.05em;
    }
    .field input, .field select {
      width: 100%; padding: 9px 12px;
      border: 1.5px solid #d1d5db; border-radius: 6px;
      font-size: 0.9375rem; font-family: inherit;
      color: #111827; background: #fff;
    }
    .field input:focus, .field select:focus {
      outline: none; border-color: #1B4332;
    }
    .field input.invalid, .field select.invalid { border-color: #dc2626; }
    .field-error { font-size: 0.75rem; color: #dc2626; margin-top: 4px; display: none; }
    .req { color: #dc2626; }
    .btn-submit {
      width: 100%; padding: 11px;
      background: #1B4332; color: #fff;
      border: none; border-radius: 6px;
      font-size: 1rem; font-weight: 600; font-family: inherit;
      cursor: pointer; margin-top: 8px;
    }
    .btn-submit:hover:not(:disabled) { background: #14532d; }
    .btn-submit:disabled { background: #9ca3af; cursor: not-allowed; }

    .spinner-wrap { text-align: center; padding: 48px 16px; }
    .spinner {
      width: 44px; height: 44px;
      border: 3px solid #e5e7eb; border-top-color: #1B4332;
      border-radius: 50%;
      animation: spin 0.75s linear infinite;
      margin: 0 auto 20px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .spinner-title { font-size: 1rem; font-weight: 600; color: #111827; margin-bottom: 6px; }
    .spinner-note { font-size: 0.875rem; color: #6b7280; }
    .warmup-note {
      font-size: 0.8125rem; color: #92400e;
      background: #fffbeb; border: 1px solid #fcd34d;
      border-radius: 6px; padding: 10px 14px; margin-top: 20px; display: none;
    }

    .result-icon { font-size: 2.5rem; margin-bottom: 12px; }
    .result-title { font-size: 1.125rem; font-weight: 700; margin-bottom: 6px; }
    .result-sub { font-size: 0.875rem; color: #6b7280; margin-bottom: 20px; }
    .success-title { color: #14532d; }
    .error-title { color: #991b1b; }
    .btn-group { display: flex; flex-direction: column; gap: 8px; }
    .btn-primary {
      display: block; text-align: center; padding: 10px 16px;
      background: #1B4332; color: #fff; border-radius: 6px;
      text-decoration: none; font-weight: 600; font-size: 0.9375rem;
    }
    .btn-outline {
      display: block; text-align: center; padding: 10px 16px;
      border: 1.5px solid #d1d5db; color: #374151;
      border-radius: 6px; text-decoration: none; font-size: 0.9375rem;
    }
    .reset-link {
      display: block; text-align: center; margin-top: 16px;
      font-size: 0.875rem; color: #1B4332; text-decoration: underline;
      cursor: pointer; background: none; border: none; font-family: inherit;
    }
  </style>
</head>
<body>

  <!-- Form view -->
  <div class="card" id="view-form">
    <div class="card-title">Due Diligence Report</div>
    <div class="card-sub">Runs the full pipeline and saves results to Airtable and Drive.</div>
    <form id="ddr-form" novalidate>
      <div class="form-row">
        <div class="field">
          <label for="state">State <span class="req">*</span></label>
          <select id="state" name="state">
            <option value="">Select...</option>
            <option value="NM">New Mexico</option>
            <option value="OR">Oregon</option>
            <option value="FL">Florida</option>
          </select>
          <div class="field-error" id="state-err">Required</div>
        </div>
        <div class="field">
          <label for="county">County <span class="req">*</span></label>
          <select id="county" name="county">
            <option value="">--</option>
          </select>
          <div class="field-error" id="county-err">Required</div>
        </div>
      </div>
      <div class="field">
        <label for="apn">APN <span class="req">*</span></label>
        <input type="text" id="apn" name="apn" placeholder="e.g. R258820">
        <div class="field-error" id="apn-err">Required</div>
      </div>
      <div class="field">
        <label for="owner_name">Owner Name</label>
        <input type="text" id="owner_name" name="owner_name" placeholder="Optional">
      </div>
      <div class="form-row">
        <div class="field">
          <label for="size">Size (acres)</label>
          <input type="number" id="size" name="size" step="0.01" min="0" placeholder="Optional">
        </div>
        <div class="field">
          <label for="subdivision">Subdivision</label>
          <input type="text" id="subdivision" name="subdivision" placeholder="Optional">
        </div>
      </div>
      <div class="field">
        <label for="drive_folder_id">Drive Folder ID</label>
        <input type="text" id="drive_folder_id" name="drive_folder_id" placeholder="Optional">
      </div>
      <button type="submit" class="btn-submit" id="submit-btn">Run Due Diligence</button>
    </form>
  </div>

  <!-- Spinner view -->
  <div class="card" id="view-spinner" style="display:none">
    <div class="spinner-wrap">
      <div class="spinner"></div>
      <div class="spinner-title">Running due diligence pipeline...</div>
      <div class="spinner-note">This takes 2 to 4 minutes. Do not close this tab.</div>
      <div class="warmup-note" id="warmup-msg">
        Still working. Render is warming up after being idle. This is normal.
      </div>
    </div>
  </div>

  <!-- Success view -->
  <div class="card" id="view-success" style="display:none">
    <div class="result-icon">&#10003;</div>
    <div class="result-title success-title" id="success-title">Report complete</div>
    <div class="result-sub">PDF saved to Drive and record updated in Airtable.</div>
    <div class="btn-group">
      <a href="#" class="btn-primary" id="pdf-link" target="_blank" rel="noopener">Download PDF</a>
      <a href="#" class="btn-outline" id="airtable-link" target="_blank" rel="noopener">View in Airtable</a>
    </div>
    <button class="reset-link" onclick="location.reload()">Run another report</button>
  </div>

  <!-- Error view -->
  <div class="card" id="view-error" style="display:none">
    <div class="result-icon">&#33;</div>
    <div class="result-title error-title">Something went wrong</div>
    <div class="result-sub" id="error-msg"></div>
    <button class="reset-link" onclick="location.reload()">Try again</button>
  </div>

  <script>
    // ── Config — set these before deploying ──────────────────────────────────
    const BACKEND_URL = "https://your-render-url.onrender.com";
    const DEFAULT_DRIVE_FOLDER_ID = "";
    // ─────────────────────────────────────────────────────────────────────────

    const COUNTY_MAP = { NM: ["Luna"], OR: ["Klamath"], FL: ["Putnam"] };

    if (DEFAULT_DRIVE_FOLDER_ID) {
      document.getElementById("drive_folder_id").value = DEFAULT_DRIVE_FOLDER_ID;
    }

    document.getElementById("state").addEventListener("change", function () {
      const countyEl = document.getElementById("county");
      const counties = COUNTY_MAP[this.value] || [];
      countyEl.innerHTML = counties.length
        ? counties.map(c => `<option value="${c}">${c}</option>`).join("")
        : `<option value="">--</option>`;
    });

    function showView(id) {
      ["view-form", "view-spinner", "view-success", "view-error"].forEach(v => {
        document.getElementById(v).style.display = v === id ? "" : "none";
      });
    }

    function validate() {
      let ok = true;
      [["state", "state-err"], ["county", "county-err"], ["apn", "apn-err"]].forEach(([fid, eid]) => {
        const el = document.getElementById(fid);
        const err = document.getElementById(eid);
        if (!el.value.trim()) {
          el.classList.add("invalid");
          err.style.display = "block";
          ok = false;
        } else {
          el.classList.remove("invalid");
          err.style.display = "none";
        }
      });
      return ok;
    }

    document.getElementById("ddr-form").addEventListener("submit", async function (e) {
      e.preventDefault();
      if (!validate()) return;

      showView("view-spinner");

      const warmupTimer = setTimeout(() => {
        document.getElementById("warmup-msg").style.display = "block";
      }, 40000);

      try {
        const body = new URLSearchParams(new FormData(this)).toString();
        const resp = await fetch(BACKEND_URL + "/generate", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body,
        });
        clearTimeout(warmupTimer);
        const json = await resp.json();

        if (resp.ok && json.status === "complete") {
          document.getElementById("success-title").textContent =
            "Report complete for " + json.apn;
          document.getElementById("pdf-link").href = json.pdf_url || "#";
          document.getElementById("airtable-link").href = json.record_url || "#";
          showView("view-success");
        } else {
          document.getElementById("error-msg").textContent =
            json.message || "Unknown error. Check server logs.";
          showView("view-error");
        }
      } catch (err) {
        clearTimeout(warmupTimer);
        document.getElementById("error-msg").textContent =
          err.message || "Network error. Is the backend running?";
        showView("view-error");
      }
    });
  </script>
</body>
</html>
```

- [ ] **Step 2: Open in browser and verify**

Open `tools/ddr/static/index.html` directly in a browser (file:// is fine for visual check).

Verify:
- Form renders with State and County dropdowns, APN field, optional fields, green button
- Selecting New Mexico auto-fills County with "Luna"
- Selecting Oregon auto-fills County with "Klamath"
- Selecting Florida auto-fills County with "Putnam"
- Submitting with empty State/County/APN shows inline red "Required" errors
- Card is centered and readable on a narrow mobile-width window (resize to ~375px)

- [ ] **Step 3: Commit**

```bash
git add tools/ddr/static/index.html
git commit -m "feat: add static HTML form for Cloudflare Pages deployment"
```

---

## Self-Review Checklist (already verified)

- **Spec coverage:** All 5 files from the spec are covered. CORS middleware, synchronous /generate, find_or_create_record, render.yaml, .env.example additions, and static HTML all present.
- **Placeholders:** `BACKEND_URL` and `DEFAULT_DRIVE_FOLDER_ID` in the HTML are intentional — set at deploy time per the spec.
- **Type consistency:** `find_or_create_record` signature in Task 2 matches the call site in Task 3 (`apn, county, state, owner_name, size, subdivision, folder`).
- **owner_name:** Accepted as a form field but not written to Airtable (no `F_OWNER_NAME` field exists). Accepted silently per design doc.
- **Trailing space on "Due Diligence":** Comment added in implementation. If the Airtable write fails, check the exact option name in the UI.
