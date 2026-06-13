# DDR Automation — Due Diligence Report System
## Land to Land Holdings LLC

Automated due diligence pipeline for vacant land acquisitions. When an Airtable property record's Status changes to "Due Diligence", this system:

1. Scrapes the county assessor portal for parcel data
2. Researches zoning, utilities, flood zone, road access, and location via Claude + web search
3. Finds and validates sold vacant land comps
4. Calculates recommended acquisition price by market (Luna NM, Klamath OR, Putnam FL)
5. Generates a property decision (Accept / Decline / Second Opinion)
6. Produces a branded PDF due diligence report
7. Saves the PDF to Google Drive
8. Writes all data back to the Airtable record

---

## Deploying to Railway (step-by-step)

### Step 1 — Create a GitHub repo and push this code

Run these commands from inside the `ddr-automation/` folder:

```bash
git init
git add .
git commit -m "feat: initial DDR automation system"
```

Now create a new repo on GitHub:
1. Go to https://github.com/new
2. Name it `ddr-automation`
3. Set it to **Private**
4. Do NOT initialize with a README (you already have one)
5. Click **Create repository**

Then push:
```bash
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/ddr-automation.git
git branch -M main
git push -u origin main
```

---

### Step 2 — Create a Railway project

1. Go to https://railway.app and sign in (or create an account)
2. Click **New Project**
3. Choose **Deploy from GitHub repo**
4. Authorize Railway to access your GitHub account if prompted
5. Select the `ddr-automation` repo
6. Railway will detect the `railway.toml` and start building automatically

The first build installs Python packages AND runs `playwright install chromium`, which takes about 3-5 minutes.

---

### Step 3 — Set environment variables in Railway

In your Railway project, click the service, then go to **Variables**. Add each of these:

| Variable | Value |
|---|---|
| `ANTHROPIC_API_KEY` | Your Anthropic API key (starts with `sk-ant-`) |
| `AIRTABLE_API_KEY` | Your Airtable personal access token (starts with `pat`) |
| `AIRTABLE_BASE_ID` | `appE5El6Tgi6LS2Z6` |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | The full JSON string of your service account (see Step 5) |
| `WEBHOOK_SECRET` | A long random string you make up (e.g., `ddr-secret-abc123xyz`) |

Railway will redeploy automatically after you save the variables.

---

### Step 4 — Get your Railway deployment URL

1. In your Railway project, click the service
2. Click **Settings** → **Networking** → **Generate Domain**
3. Your URL will look like: `https://ddr-automation-production.up.railway.app`

Test that it's running:
```
GET https://your-railway-url.up.railway.app/health
```
Expected response: `{"status": "ok", "version": "1.0.0"}`

---

### Step 5 — Set up Google Cloud service account

You need a service account that can upload files to your Google Drive folder.

**Create the project and credentials:**

1. Go to https://console.cloud.google.com
2. Click **Select a project** → **New Project** → name it `ddr-automation` → **Create**
3. In the left menu, go to **APIs & Services** → **Library**
4. Search for **Google Drive API** and click **Enable**
5. Go to **APIs & Services** → **Credentials**
6. Click **Create Credentials** → **Service Account**
7. Name: `ddr-automation-sa` → **Create and Continue** → **Done**
8. Click the service account email to open it
9. Go to the **Keys** tab → **Add Key** → **Create new key** → **JSON** → **Create**
10. A JSON file downloads to your computer — open it

**Copy the JSON into Railway:**

1. Open the downloaded JSON file in a text editor
2. Select ALL the text (Cmd+A)
3. Copy it
4. In Railway Variables, paste it as the value for `GOOGLE_SERVICE_ACCOUNT_JSON`
5. The value should look like: `{"type":"service_account","project_id":"...",...}`

**Share your Drive folder with the service account:**

1. In the JSON file, find the `"client_email"` field — it looks like `ddr-automation-sa@ddr-automation-XXXXX.iam.gserviceaccount.com`
2. Go to your Google Drive and open the folder where reports should be saved
3. Click **Share** (the person icon)
4. Paste the service account email
5. Set permission to **Editor**
6. Click **Send**

Now the system can upload PDFs to that folder automatically.

---

### Step 6 — Configure Airtable automation

In your Airtable **Ground Control** base:

1. Go to **Automations** (the lightning bolt icon at the top)
2. Click **+ New automation**
3. **Trigger:** Choose "When record matches conditions"
   - Table: `Properties`
   - Condition: `Status` → `is` → `Due Diligence`
4. **Action:** Choose "Send a webhook"
   - URL: `https://your-railway-url.up.railway.app/webhook`
   - Method: `POST`
   - Headers: Add `X-Webhook-Secret` = the `WEBHOOK_SECRET` value you set in Railway
   - Body: Select **Custom body** and enter:
     ```json
     {"record_id": "{{record_id}}"}
     ```
     Click the `+` to insert the dynamic `record_id` field from the trigger record
5. Click **Test automation** to send a test webhook
6. Turn the automation **On**

---

### Step 7 — Run the test pipeline

Before going live, validate the full pipeline end-to-end using the test endpoint:

```bash
curl -X POST https://your-railway-url.up.railway.app/test
```

This runs the pipeline on a synthetic property: APN `R258820`, Klamath County OR.

Check Railway logs (in the service → **Logs** tab) — you should see each step logged:
- Step 1: parcel scrape
- Step 2: web research
- Step 3: comps search
- Steps 4-8: pricing, recommendation, PDF, Drive, Airtable

Since it's test mode, nothing writes back to Airtable and no PDF is saved. The final JSON summary is logged.

---

## Architecture

```
Airtable webhook (Status = "Due Diligence")
        ↓
POST /webhook → FastAPI (returns 200 immediately)
        ↓
BackgroundTask: run_pipeline(record_id)
        ↓
┌─────────────────────────────────────────┐
│ Step 1  parcel_scraper.py               │ ← County assessor + web search
│ Step 2  research.py                     │ ← Zoning, utilities, flood, etc.
│ Step 3  comps.py                        │ ← Vacant land comps only
│ Step 4  pricing.py                      │ ← Market-specific formulas
│ Step 5  recommendation.py               │ ← Claude decision + red flags
│ Step 6  pdf_generator.py                │ ← Branded PDF via ReportLab
│ Step 7  drive_uploader.py               │ ← Save to Google Drive
│ Step 8  airtable.py                     │ ← Write all fields back
└─────────────────────────────────────────┘
```

---

## Pricing rules

| Market | Acquisition Offer | Output |
|---|---|---|
| Luna County NM | 25% × median comp price | Single dollar amount |
| Klamath County OR | 25% × median comp price | Single dollar amount |
| Putnam County FL | 30-35% × median comp price | Dollar range (midpoint in Airtable) |

Retail Cash Price = median comp sold price (all markets).

---

## Decision rules

| Decision | When |
|---|---|
| Accept and Close | Pricing works, no hard red flags, access confirmed, flood zone X or none |
| Decline | Flood zone A/AE, no legal access, back taxes >20% of acquisition price, title issue |
| Request Second-Opinion | Borderline, fewer than 3 comps, incomplete parcel data, any uncertainty |

---

## Red flags (auto-populated)

`Back Taxes` · `Title Discrepancy` · `No Access` · `Owner Deceased` · `Other` · `None`

---

## Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/health` | GET | Health check — returns `{"status":"ok","version":"1.0.0"}` |
| `/webhook` | POST | Airtable trigger — requires `X-Webhook-Secret` header |
| `/test` | POST | Test pipeline with OR-Klamath-R258820 (no Airtable write) |

---

## Troubleshooting

**Build fails on Railway:** Check the build logs for Playwright install errors. The `playwright install-deps chromium` step needs system libraries. If it fails, try adding a `nixpacks.toml` with `[phases.setup] nixPkgs = ["chromium", "nss", "mesa"]`.

**Webhook returns 401:** Make sure the `X-Webhook-Secret` header in Airtable matches `WEBHOOK_SECRET` in Railway exactly.

**PDF not in Drive:** Confirm the service account email has Editor access to the target folder. Check the `drive_folder_id` field is populated on the Airtable record.

**Comps low confidence warning:** This is normal for rural markets with few sales. The pipeline still runs and generates a report — it just flags the uncertainty.

**Parcel data shows "Requires Manual Verification":** The county assessor site may have changed or was unreachable. The `DD Raw JSON` field shows which fields need manual entry. The PDF will still generate with those fields marked.
