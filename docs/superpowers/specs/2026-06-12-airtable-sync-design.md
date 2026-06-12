# Phase 2: Airtable Sync Design

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this spec task-by-task.

**Goal:** Replace the static sample `src/_data/properties.json` with a live sync from the Ground Control Airtable base, triggered automatically when Tyler checks "Ready for Website" on a record.

**Architecture:** Single-file Node.js sync script (`scripts/sync.mjs`) with no new npm dependencies. Airtable Automation fires a GitHub `repository_dispatch` webhook on checkbox change. GitHub Action runs sync, builds, commits, and pushes to main. Cloudflare Pages deploys on push.

**Airtable base:** `appE5El6Tgi6LS2Z6` (Ground Control), table: `Properties` (`tblIXORnaELK4K4w8`)

---

## Prerequisites (Tyler does these manually before first run)

### 1. Add "Ready for Website" field to Airtable
In Ground Control > Properties table, add a new **Checkbox** field named exactly `Ready for Website`. Leave default unchecked.

### 2. Generate a GitHub PAT
Go to GitHub → Settings → Developer Settings → Personal Access Tokens → Tokens (classic). Generate a token with **`repo`** scope. Copy it -- you'll use it in two places.

### 3. Add GitHub secret: AIRTABLE_PAT
In the land-to-land-website repo → Settings → Secrets and variables → Actions → New repository secret:
- Name: `AIRTABLE_PAT`
- Value: your Airtable Personal Access Token (read-only scope on `appE5El6Tgi6LS2Z6`)

### 4. Set up Airtable Automation
In Ground Control → Automations → New automation:
- **Trigger:** When a record is updated → Field: "Ready for Website"
- **Action:** Send a webhook
  - Method: POST
  - URL: `https://api.github.com/repos/tylerqbush/land-to-land-website/dispatches`
  - Headers:
    - `Authorization: token YOUR_GITHUB_PAT` (the token from step 2)
    - `Accept: application/vnd.github.v3+json`
    - `Content-Type: application/json`
  - Body: `{"event_type": "airtable-sync"}`

---

## Files Created or Modified

| File | Action | Purpose |
|---|---|---|
| `scripts/sync.mjs` | Rewrite | Core sync script |
| `data/hashes.json` | Create | Per-record fingerprints (committed) |
| `src/_data/properties.json` | Overwrite on sync | Live property data |
| `.github/workflows/sync.yml` | Create | GitHub Action |
| `src/property/property.njk` | Modify | Add term_months display |
| `tests/sync.test.mjs` | Create | Unit tests for sync logic |
| `.gitignore` | Modify | Add .env and .sync-message |
| `.env.example` | Create | Document required env vars |

---

## Field Mapping

| `properties.json` key | Airtable field name | Field ID | Notes |
|---|---|---|---|
| `id` | Property ID | `fldC50vOT5yLZFmLs` | |
| `name` | Property Name | `fldmtqV4oIHrqBD0G` | formula |
| `status` | Status | `fldGyOzIt4qLKmDzZ` | trim trailing spaces |
| `acreage` | Size | `fldCLtCkLfnJwxkNl` | parse float from "5" or "5.5 acres" |
| `city` | City | `fldUkyrAdOKFPRAS7` | |
| `county` | County | `fldNa7VH7kTgmfSnN` | |
| `state` | State Abbreviation | `fldN6dWH9UzlAWo3M` | |
| `lat` | GPS Coordinates | `fldj9dKEIxSnrpDXa` | parse first float from "29.65, -81.51" |
| `lng` | GPS Coordinates | `fldj9dKEIxSnrpDXa` | parse second float |
| `monthly` | Easy Financing - per month | `fldrGWJUuiSpNDhmK` | displayed as $/mo, no tier label |
| `term_months` | Easy Financing - total no. of months | `fldGMrq8rZLNQVxMN` | e.g. 48 |
| `down` | Down Payment | `fldXADhg3U4jDx7Ap` | |
| `doc_fee` | Processing Fee | `fldxKI8mZ9MGuW6M7` | |
| `cash_price` | Cash Purchase Price | `fldWa27h5W11nVh1d` | |
| `geekpay_url` | GeekPay Checkout URL | `fldC434guBKgVwO76` | null or missing → no buy button |
| `description` | Web Description | `fldl6LF5XTVBHgqh9` | aiText field |
| `apn` | Parcel Number (APN) | `fldSmkSyNu8wlNPNI` | |
| `address` | Street Address | `fldECzLTq7jpkmje5` | |
| `gps` | GPS Coordinates | `fldj9dKEIxSnrpDXa` | raw string for display |
| `google_maps_url` | Google Maps Link | `fldcfC8RTfQtTgv2J` | |
| `annual_taxes` | Annual Taxes | `fldlJp4W00wKPRObp` | |
| `zoning` | Zoning Designation | `fldzWRUtCevU4OAK6` | |
| `elevation` | Elevation | `fldyo0rCK5A1FESdh` | |
| `terrain` | Terrain | `fld6KbD0X9fRtLN2U` | |
| `lot_dimensions` | Lot Dimensions | `fldOFjVgsvTftBMQ4` | |
| `time_limit_to_build` | Time Limit to Build | `fldUfgf7KR2x1BRdQ` | |
| `single_family_allowed` | Single Family Homes Allowed? | `fldMUPfGBAZyam93u` | |
| `modular_allowed` | Modular Homes Allowed? | `fldGCXU52wjnUwtGd` | |
| `manufactured_allowed` | Manufactured Homes Allowed? | `fldqMOWG8sslT3Mdb` | |
| `tiny_home_friendly` | Tiny Home Friendly? | `fld5193iXuef6A5gM` | |
| `septic_required` | Septic System Required to Building? | `fldM2DFIjeeq9Eisi` | |
| `flood_plain` | Property Located in a Flood Plain? | `fldxnsvVsEQ5IKIyE` | |
| `full_time_rv` | Full-Time RV Living Allowed? | `fldzUMLhTctBaIUnY` | |
| `rv_while_build` | RV Allowed on the Property While I Build? | `fldqxjzidhBjSdfZd` | |
| `camping_rv` | Camping in an RV Allowed? | `fldEQ0LbyGZt4NlyF` | |
| `tent_camping` | Tent Camping Allowed? | `fldoNw5tWHTzdEOOe` | |
| `hunting` | Hunting Allowed? | `fldrv1wCoQFVKE90P` | |
| `well` | Allowable to Drill a Well? | `flduyI6Epr4KFWE8C` | |
| `septic` | Is it allowable to install a septic system? | `fldMWxtk5wWJn2se1` | |
| `electricity` | Currently have electricity? | `fld9PyUElUycXrGG4` | |
| `solar` | Solar Allowed? | `fld5n4YtHRYWnXEy2` | |
| `propane` | Propane Tanks Allowed? | `fldEfOuA7GOdKlCV2` | |
| `gas` | Currently have Gas? | `fld8A1BCocjXDmykf` | |
| `road_access` | Access | `fldeR6VNBorQc0IE5` | singleSelect |
| `video_url` | Featured Video | `fldJsDm6W3K1Rig1s` | |
| `photos` | Photos | `fldoc2FE0V3ipGIAQ` | downloaded; paths rewritten to /assets/properties/{id}/ |
| `seo_title` | SEO-Title: | `fldc8Mo0fEDmpStna` | formula |
| `seo_description` | SEO-Meta Description: | `flduhnfzZLw507apt` | formula |
| `seo_keywords` | SEO-Keywords | `fldbQ6NNl5hkXR6pz` | formula |
| `slug` | generated | — | {acreage}-acre-{city}-{county}-{state}-{id} kebab; stable once published |

---

## Publishable Statuses

After trimming trailing spaces, publish only:
- `Active`
- `Under Contract`
- `Sold`

Discard: `Due Diligence`, `Acquisition Closing`, anything else.

---

## sync.mjs — Five Phases

### Phase 1: Fetch
```
GET https://api.airtable.com/v0/appE5El6Tgi6LS2Z6/tblIXORnaELK4K4w8
  ?filterByFormula={Ready for Website}=TRUE
  &pageSize=100
  &offset={offset if paginating}
Authorization: Bearer {AIRTABLE_PAT}
```
- Paginate until no offset returned
- Trim Status values
- Discard non-publishable statuses
- Throw on any non-200 response

### Phase 2: Diff
Load `data/hashes.json` (default `{}`). For each fetched record compute:
- **Content hash:** SHA-256 of `JSON.stringify` of all non-photo fields, keys sorted
- **Photo hash:** comma-joined list of Airtable attachment `id` values (stable; not URLs which rotate)

Compare to stored hashes. Classify each record as `added`, `updated`, or `unchanged`.
Records in `hashes.json` not present in fetch results → `removed`.

### Phase 3: Photos
For each `added` or `updated` record:
- Create `assets/properties/{id}/` if needed
- Download each attachment URL with `fetch`, save as `1.jpg`, `2.jpg`, etc.
- On any download failure: throw (no partial state)

For each `removed` record:
- Delete `assets/properties/{id}/` directory

### Phase 4: Write
- Load previous `src/_data/properties.json` to extract existing slugs (keyed by `id`)
- Generate slug for each record: `{acreage}-acre-{city}-{county}-{state}-{id}` in kebab-case
  - If a slug already exists for that `id` in the previous file, use it unchanged
- Build full properties array (all current records, removed ones excluded)
- Write `src/_data/properties.json`
- Write updated `data/hashes.json`

### Phase 5: Report
Print one line: `sync: N updated, M added, K removed — ID1 ID2 ID3`
If all counts are zero, print `sync: no changes` and exit with code 0.
The GitHub Action reads stdout to determine commit message and whether to commit.

---

## Slug Generation

```
{acreage}-acre-{city}-{county}-{state}-{id}
```

Rules:
- Lowercase everything
- Replace spaces and non-alphanumeric characters with hyphens
- Collapse multiple hyphens to one
- Strip leading/trailing hyphens from each segment
- Property ID lowercased: `LTL-001` → `ltl-001`

Example: 5 acres, Satsuma, Putnam County, FL, LTL-001 → `5-acre-satsuma-putnam-fl-ltl-001`

---

## Hash File Format

```json
{
  "LTL-001": {
    "content": "sha256hex...",
    "photos": "attAbc123,attDef456"
  }
}
```

---

## GitHub Action: .github/workflows/sync.yml

```yaml
name: Airtable Sync

on:
  repository_dispatch:
    types: [airtable-sync]
  schedule:
    - cron: '0 10 * * *'
  workflow_dispatch:

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          token: ${{ secrets.GITHUB_TOKEN }}

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - run: npm ci

      - name: Run sync
        env:
          AIRTABLE_PAT: ${{ secrets.AIRTABLE_PAT }}
        run: npm run sync

      - name: Build site
        run: npm run build

      - name: Commit and push if changed
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add src/_data/properties.json data/hashes.json assets/properties/
          if git diff --cached --quiet; then
            echo "Nothing to commit"
          else
            SYNC_MSG=$(cat .sync-message 2>/dev/null || echo "sync: changes")
            git commit -m "$SYNC_MSG"
            git push
          fi
```

The sync script writes its one-line summary to `.sync-message` (gitignored) so the Action can use it as the commit message.

---

## Tests: tests/sync.test.mjs

Unit tests covering sync logic functions (imported, not executed):

| Test | What it verifies |
|---|---|
| slug generation | correct format, kebab-case, ID lowercased |
| slug stability | existing slug preserved when inputs change |
| status normalization | trailing spaces stripped |
| status filtering | Due Diligence discarded, Active passes |
| GPS parsing | "29.65, -81.51" → `{ lat: 29.65, lng: -81.51 }` |
| size parsing | "5 acres" → 5, "10" → 10, "2.5" → 2.5 |
| content hashing | same input → same hash, different input → different hash |
| photo hash | uses attachment id not url |
| diff: added | record not in hashes → added |
| diff: updated | content hash changed → updated |
| diff: unchanged | same hashes → unchanged |
| diff: removed | in hashes but not in fetch → removed |
| geekpay null | missing or empty string → null |

---

## Error Handling

The script throws (non-zero exit) on:
- Airtable API returns non-200
- Any photo download fails
- `AIRTABLE_PAT` env var is not set
- A publishable record is missing `id`, `city`, `county`, `state`, `monthly`

It never writes `properties.json` or `hashes.json` if an error occurred -- both writes happen together at the end of Phase 4 only.

---

## Local Development

Add `.env` to `.gitignore`. Create `.env.example`:
```
AIRTABLE_PAT=your_pat_here
```

Run sync locally:
```bash
# install dotenv one-time for local dev only (not in package.json dependencies)
node --env-file=.env scripts/sync.mjs
```

Node 20+ supports `--env-file` natively, no dotenv package needed.

---

## Out of Scope for Phase 2

- WebP / image resizing (Sharp) -- photos downloaded as-is
- Redirect map for changed slugs -- slugs are preserved by ID, documented risk
- Video embedding on listing pages -- `video_url` field is stored but template not wired
- Custom Photo Links field -- Photos attachment field is the source; Custom Photo Links ignored
