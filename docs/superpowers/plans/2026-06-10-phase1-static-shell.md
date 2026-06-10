# Phase 1 Static Shell — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy a six-page Eleventy static site with hardcoded sample data to a Cloudflare Pages preview URL.

**Architecture:** Eleventy 3.x reads `src/_data/properties.json` at build time and generates static HTML into `_site/`. The listing detail pages are generated via Eleventy pagination — one HTML file per property record. All filtering on the Property Map page is client-side JavaScript reading `window.PROPERTIES`. No server, no API calls at runtime.

**Tech Stack:** Eleventy 3.x, Nunjucks templates, vanilla CSS (custom properties), vanilla JS, Leaflet + Esri World Imagery, @quasibit/eleventy-plugin-sitemap, Node built-in test runner (`node:test`), GitHub, Cloudflare Pages, `gh` CLI, `wrangler` CLI.

**Design reference:** `docs/superpowers/specs/2026-06-10-phase1-static-shell-design.md`

**Content reference:** `content-reference.md` (verbatim copy for all pages)

---

## File Map

```
/
├── src/
│   ├── _includes/
│   │   ├── base.njk                  ← global layout shell (nav + footer + script stubs)
│   │   └── partials/
│   │       ├── nav.njk               ← navigation bar
│   │       ├── footer.njk            ← site footer
│   │       ├── hero.njk              ← full-width photo hero macro
│   │       ├── trust-bar.njk         ← $0 bank / no credit / 30-day strip
│   │       └── property-card.njk     ← reusable listing card
│   ├── _data/
│   │   └── properties.json           ← hardcoded sample data (3 properties)
│   ├── index.njk                     ← Home page
│   ├── properties.njk                ← Property Map page (Leaflet + filter + card grid)
│   ├── property/
│   │   └── property.njk              ← Listing detail (Eleventy pagination → 1 file per record)
│   ├── how-it-works.njk
│   ├── about.njk
│   ├── make-a-payment.njk
│   └── 404.html
├── assets/
│   ├── css/
│   │   └── styles.css                ← all CSS: tokens, resets, typography, components
│   ├── js/
│   │   └── map.js                    ← Leaflet init + marker rendering
│   ├── images/
│   │   └── logo.svg                  ← copied from iCloud source
│   └── properties/
│       ├── LTL-001/1.jpg             ← Unsplash placeholder (committed)
│       ├── LTL-002/1.jpg
│       └── LTL-003/1.jpg
├── tests/
│   ├── data.test.mjs                 ← validates properties.json shape
│   └── build.test.mjs                ← validates _site/ output (run after build)
├── scripts/
│   └── sync.mjs                      ← Phase 2 stub (exits with message)
├── .eleventy.js
├── package.json
├── .gitignore
└── robots.txt                        ← allow all, point to sitemap
```

---

## Task 1: Project scaffold and GitHub repo

**Files:**
- Create: `package.json`
- Create: `.eleventy.js`
- Create: `.gitignore`
- Create: `scripts/sync.mjs`
- Create all directories in the file map above (empty)

- [ ] **Step 1.1: Create the project directory structure**

```bash
mkdir -p src/_includes/partials src/_data src/property \
         assets/css assets/js assets/images \
         "assets/properties/LTL-001" "assets/properties/LTL-002" "assets/properties/LTL-003" \
         tests scripts docs/superpowers/specs docs/superpowers/plans
```

- [ ] **Step 1.2: Create `package.json`**

```json
{
  "name": "land-to-land-website",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "eleventy --serve",
    "build": "eleventy",
    "sync": "node scripts/sync.mjs",
    "test": "node --test tests/data.test.mjs",
    "test:build": "npm run build && node --test tests/build.test.mjs"
  },
  "dependencies": {
    "@11ty/eleventy": "^3.0.0",
    "@quasibit/eleventy-plugin-sitemap": "^2.4.0"
  }
}
```

- [ ] **Step 1.3: Install dependencies**

```bash
npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 1.4: Create `.eleventy.js`**

```js
import pluginSitemap from "@quasibit/eleventy-plugin-sitemap";

export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("assets");
  eleventyConfig.addPassthroughCopy({ "src/robots.txt": "robots.txt" });

  eleventyConfig.addPlugin(pluginSitemap, {
    sitemap: { hostname: "https://landtolandholdings.com" },
  });

  // Make properties available on window for the map page
  eleventyConfig.addFilter("json", (value) => JSON.stringify(value));

  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      data: "_data",
    },
    templateFormats: ["njk", "html"],
    htmlTemplateEngine: "njk",
  };
}
```

- [ ] **Step 1.5: Create `scripts/sync.mjs` stub**

```js
// Phase 2: pulls Ground Control from Airtable, writes src/_data/properties.json,
// downloads and resizes photos into assets/properties/{id}/
console.error("sync is not implemented in Phase 1. Run in Phase 2.");
process.exit(1);
```

- [ ] **Step 1.6: Create `.gitignore`**

```
node_modules/
_site/
.DS_Store
.env
.superpowers/
```

- [ ] **Step 1.7: Create GitHub repo and push**

```bash
gh repo create land-to-land-website --private --source=. --remote=origin --push \
  --description "Land to Land Holdings static site"
```

Expected: repo created at `github.com/<your-username>/land-to-land-website`, initial commit pushed.

- [ ] **Step 1.8: Verify Eleventy can start (no templates yet, that's fine)**

```bash
npm run build
```

Expected: `_site/` created, no fatal errors (may warn about empty input).

- [ ] **Step 1.9: Commit**

```bash
git add package.json package-lock.json .eleventy.js .gitignore scripts/sync.mjs
git commit -m "chore: scaffold Eleventy project with deps and CF Pages config"
git push
```

---

## Task 2: Sample data and data validation tests

**Files:**
- Create: `src/_data/properties.json`
- Create: `tests/data.test.mjs`

- [ ] **Step 2.1: Write the failing test first**

Create `tests/data.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const properties = JSON.parse(
  readFileSync("src/_data/properties.json", "utf8")
);

test("properties.json is an array with at least one entry", () => {
  assert.ok(Array.isArray(properties));
  assert.ok(properties.length >= 1);
});

test("each property has required identity fields", () => {
  for (const p of properties) {
    assert.ok(p.id, `${p.id}: missing id`);
    assert.ok(p.slug, `${p.id}: missing slug`);
    assert.ok(p.city, `${p.id}: missing city`);
    assert.ok(p.county, `${p.id}: missing county`);
    assert.ok(p.state, `${p.id}: missing state`);
  }
});

test("each property has a valid status", () => {
  const valid = ["Active", "Under Contract", "Sold"];
  for (const p of properties) {
    assert.ok(valid.includes(p.status), `${p.id}: invalid status "${p.status}"`);
  }
});

test("each property has positive numeric pricing", () => {
  for (const p of properties) {
    assert.ok(typeof p.monthly === "number" && p.monthly > 0, `${p.id}: monthly must be positive number`);
    assert.ok(typeof p.down === "number" && p.down >= 0, `${p.id}: down must be non-negative number`);
    assert.ok(typeof p.doc_fee === "number" && p.doc_fee >= 0, `${p.id}: doc_fee must be non-negative number`);
  }
});

test("slug format matches {acreage}-acre-{city}-{county}-{state}-{id} pattern", () => {
  for (const p of properties) {
    const parts = p.slug.split("-");
    assert.ok(parts.includes("acre"), `${p.id}: slug missing 'acre': ${p.slug}`);
    assert.match(p.slug, /^[a-z0-9-]+$/, `${p.id}: slug must be lowercase kebab: ${p.slug}`);
  }
});

test("geekpay_url is null or a non-empty string", () => {
  for (const p of properties) {
    assert.ok(
      p.geekpay_url === null || (typeof p.geekpay_url === "string" && p.geekpay_url.length > 0),
      `${p.id}: geekpay_url must be null or non-empty string`
    );
  }
});

test("at least one property has null geekpay_url to validate no-button rule", () => {
  const noGeekPay = properties.filter((p) => p.geekpay_url === null);
  assert.ok(noGeekPay.length >= 1, "need at least one property with null geekpay_url");
});

test("each property has lat and lng for map rendering", () => {
  for (const p of properties) {
    assert.ok(typeof p.lat === "number", `${p.id}: missing lat`);
    assert.ok(typeof p.lng === "number", `${p.id}: missing lng`);
  }
});
```

- [ ] **Step 2.2: Run the test — verify it fails**

```bash
npm test
```

Expected: FAIL — `src/_data/properties.json` does not exist yet.

- [ ] **Step 2.3: Create `src/_data/properties.json`**

```json
[
  {
    "id": "LTL-001",
    "slug": "5-acre-satsuma-putnam-fl-ltl-001",
    "status": "Active",
    "acreage": 5,
    "city": "Satsuma",
    "county": "Putnam",
    "state": "FL",
    "lat": 29.65,
    "lng": -81.51,
    "monthly": 199,
    "down": 299,
    "doc_fee": 299,
    "cash_price": 7500,
    "geekpay_url": "#",
    "description": "Five acres of peaceful countryside in Putnam County, Florida. Flat, cleared terrain with road access. No bank or credit check required — just simple monthly payments.",
    "apn": "00-00-00-0000-0000-0010",
    "address": "TBD Satsuma Rd",
    "gps": "29.650000, -81.510000",
    "google_maps_url": "https://maps.google.com/?q=29.650000,-81.510000",
    "zoning": "A-1 Agriculture",
    "annual_taxes": 120,
    "acreage_display": "5 acres",
    "elevation": "40 ft",
    "terrain": "Flat",
    "lot_dimensions": "400 x 544 ft (approx)",
    "time_limit_to_build": "None",
    "single_family_allowed": "Yes",
    "modular_allowed": "Yes",
    "manufactured_allowed": "Yes",
    "tiny_home_friendly": "Yes",
    "septic_required": "Yes",
    "flood_plain": "No",
    "full_time_rv": "No",
    "rv_while_build": "Yes",
    "camping_rv": "Yes",
    "tent_camping": "Yes",
    "hunting": "No",
    "well": "Available",
    "septic": "Required — no public sewer",
    "electricity": "Available at road",
    "solar": "Allowed",
    "propane": "Allowed",
    "gas": "Not available",
    "photos": ["/assets/properties/LTL-001/1.jpg"]
  },
  {
    "id": "LTL-002",
    "slug": "10-acre-deming-luna-nm-ltl-002",
    "status": "Under Contract",
    "acreage": 10,
    "city": "Deming",
    "county": "Luna",
    "state": "NM",
    "lat": 32.27,
    "lng": -107.75,
    "monthly": 149,
    "down": 199,
    "doc_fee": 299,
    "cash_price": 5500,
    "geekpay_url": null,
    "description": "Ten acres of high desert in Luna County, New Mexico. Open skies, mountain views, and easy access from Deming. Under contract — contact us to get on the waitlist.",
    "apn": "3-062-191-283-000",
    "address": "TBD Desert Rd",
    "gps": "32.270000, -107.750000",
    "google_maps_url": "https://maps.google.com/?q=32.270000,-107.750000",
    "zoning": "R-1 Rural Residential",
    "annual_taxes": 80,
    "acreage_display": "10 acres",
    "elevation": "4,350 ft",
    "terrain": "Level desert",
    "lot_dimensions": "660 x 660 ft (approx)",
    "time_limit_to_build": "None",
    "single_family_allowed": "Yes",
    "modular_allowed": "Yes",
    "manufactured_allowed": "Yes",
    "tiny_home_friendly": "Yes",
    "septic_required": "Yes",
    "flood_plain": "No",
    "full_time_rv": "Yes",
    "rv_while_build": "Yes",
    "camping_rv": "Yes",
    "tent_camping": "Yes",
    "hunting": "No",
    "well": "Well required",
    "septic": "Septic required",
    "electricity": "Solar recommended",
    "solar": "Allowed",
    "propane": "Allowed",
    "gas": "Not available",
    "photos": ["/assets/properties/LTL-002/1.jpg"]
  },
  {
    "id": "LTL-003",
    "slug": "2-acre-klamath-falls-klamath-or-ltl-003",
    "status": "Active",
    "acreage": 2,
    "city": "Klamath Falls",
    "county": "Klamath",
    "state": "OR",
    "lat": 42.22,
    "lng": -121.78,
    "monthly": 249,
    "down": 399,
    "doc_fee": 299,
    "cash_price": 9500,
    "geekpay_url": "#",
    "description": "Two acres in Klamath County, Oregon with mountain views and tall pines. Close to Klamath Falls amenities with a private, rural feel. No bank required.",
    "apn": "123-456-789",
    "address": "TBD Pine Rd",
    "gps": "42.220000, -121.780000",
    "google_maps_url": "https://maps.google.com/?q=42.220000,-121.780000",
    "zoning": "RR Rural Residential",
    "annual_taxes": 150,
    "acreage_display": "2 acres",
    "elevation": "4,200 ft",
    "terrain": "Gently sloped",
    "lot_dimensions": "200 x 435 ft (approx)",
    "time_limit_to_build": "None",
    "single_family_allowed": "Yes",
    "modular_allowed": "Yes",
    "manufactured_allowed": "Yes",
    "tiny_home_friendly": "Yes",
    "septic_required": "Yes",
    "flood_plain": "No",
    "full_time_rv": "No",
    "rv_while_build": "Yes",
    "camping_rv": "Yes",
    "tent_camping": "Yes",
    "hunting": "No",
    "well": "Well required",
    "septic": "Septic required",
    "electricity": "Available at road",
    "solar": "Allowed",
    "propane": "Allowed",
    "gas": "Not available",
    "photos": ["/assets/properties/LTL-003/1.jpg"]
  }
]
```

- [ ] **Step 2.4: Run the test — verify it passes**

```bash
npm test
```

Expected: all 8 tests PASS.

- [ ] **Step 2.5: Commit**

```bash
git add src/_data/properties.json tests/data.test.mjs
git commit -m "feat: add sample data and data validation tests"
git push
```

---

## Task 3: CSS foundation

**Files:**
- Create: `assets/css/styles.css`

- [ ] **Step 3.1: Create `assets/css/styles.css`**

```css
/* ─── DESIGN TOKENS ───────────────────────────────────── */
:root {
  --color-navy:          #1F4C6B;
  --color-navy-dark:     #163650;
  --color-navy-body:     #1A3347;
  --color-navy-muted:    #2E5068;
  --color-lime:          #8BC83F;
  --color-lime-text:     #0D2600;
  --color-lime-tint:     rgba(139, 200, 63, 0.12);
  --color-lime-tint-text:#4A7A1A;
  --color-white:         #FFFFFF;
  --color-off-white:     #F2F6F9;
  --color-border:        rgba(31, 76, 107, 0.10);

  --font-family: 'Inter', system-ui, sans-serif;

  --radius-btn:   5px;
  --radius-card:  8px;
  --radius-modal: 12px;

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;
  --space-12: 48px;
  --space-16: 64px;
}

/* ─── RESET ───────────────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
img, video { display: block; max-width: 100%; }
a { color: inherit; text-decoration: none; }
ul { list-style: none; }

/* ─── BASE ────────────────────────────────────────────── */
html { scroll-behavior: smooth; }

body {
  font-family: var(--font-family);
  font-size: 14px;
  font-weight: 400;
  line-height: 1.6;
  color: var(--color-navy-body);
  background: var(--color-white);
}

/* ─── TYPOGRAPHY ──────────────────────────────────────── */
.display {
  font-size: clamp(32px, 9vw, 48px);
  font-weight: 900;
  letter-spacing: -1.5px;
  line-height: 0.95;
}

.heading-lg {
  font-size: clamp(20px, 5vw, 28px);
  font-weight: 800;
  letter-spacing: -0.8px;
  line-height: 1.1;
}

.heading-md {
  font-size: 18px;
  font-weight: 800;
  letter-spacing: -0.5px;
  line-height: 1.2;
}

.eyebrow {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 2px;
  text-transform: uppercase;
}

.caption {
  font-size: 12px;
  font-weight: 500;
  color: var(--color-navy-muted);
}

/* ─── BUTTONS ─────────────────────────────────────────── */
.btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-family: var(--font-family);
  font-size: 13px;
  font-weight: 700;
  border: none;
  cursor: pointer;
  border-radius: var(--radius-btn);
  padding: 12px 20px;
  transition: opacity 0.15s ease, transform 0.1s ease;
  text-align: center;
  justify-content: center;
}

.btn:active { transform: scale(0.98); }

.btn-primary {
  background: var(--color-lime);
  color: var(--color-lime-text);
}

.btn-primary:hover { opacity: 0.9; }

.btn-secondary {
  background: transparent;
  color: var(--color-white);
  border: 2px solid rgba(255, 255, 255, 0.5);
}

.btn-secondary:hover { border-color: var(--color-white); }

.btn-outline {
  background: transparent;
  color: var(--color-navy);
  border: 2px solid var(--color-navy);
}

.btn-outline:hover { background: var(--color-navy); color: var(--color-white); }

.btn-full { width: 100%; }

/* ─── LAYOUT ──────────────────────────────────────────── */
.container {
  width: 100%;
  max-width: 1100px;
  margin: 0 auto;
  padding: 0 var(--space-4);
}

.section { padding: var(--space-12) 0; }

.section-dark {
  background: var(--color-navy-dark);
  color: var(--color-white);
}

.section-off { background: var(--color-off-white); }

/* ─── BADGE ───────────────────────────────────────────── */
.badge {
  display: inline-block;
  font-size: 10px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 4px;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.badge-active {
  background: var(--color-lime-tint);
  color: var(--color-lime-tint-text);
}

.badge-contract {
  background: rgba(255, 160, 0, 0.12);
  color: #7A5000;
}

.badge-sold {
  background: rgba(31, 76, 107, 0.10);
  color: var(--color-navy-muted);
}

/* ─── PROPERTY CARD ───────────────────────────────────── */
.property-card {
  background: var(--color-white);
  border-radius: var(--radius-card);
  overflow: hidden;
  border: 1px solid var(--color-border);
  box-shadow: 0 2px 8px rgba(31, 76, 107, 0.06);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.property-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 24px rgba(31, 76, 107, 0.12);
}

.property-card__photo {
  aspect-ratio: 16 / 9;
  overflow: hidden;
}

.property-card__photo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.property-card__body {
  padding: var(--space-3) var(--space-4) var(--space-4);
}

.property-card__price {
  font-size: 18px;
  font-weight: 900;
  letter-spacing: -0.5px;
  color: var(--color-navy);
}

.property-card__price span {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-navy-muted);
}

.property-card__meta {
  font-size: 12px;
  color: var(--color-navy-muted);
  margin-top: 2px;
  margin-bottom: var(--space-2);
}

/* ─── CARD GRID ───────────────────────────────────────── */
.card-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-4);
}

@media (min-width: 640px) {
  .card-grid { grid-template-columns: repeat(2, 1fr); }
}

@media (min-width: 1024px) {
  .card-grid { grid-template-columns: repeat(3, 1fr); }
}

/* ─── HERO ────────────────────────────────────────────── */
.hero {
  position: relative;
  min-height: 480px;
  display: flex;
  align-items: flex-end;
  overflow: hidden;
}

.hero__bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
}

.hero__overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    170deg,
    rgba(13, 34, 51, 0.78) 0%,
    rgba(31, 76, 107, 0.65) 60%,
    rgba(13, 34, 51, 0.82) 100%
  );
}

.hero__content {
  position: relative;
  z-index: 2;
  width: 100%;
  padding: var(--space-12) var(--space-4) var(--space-8);
}

.hero__eyebrow {
  color: var(--color-lime);
  margin-bottom: var(--space-3);
}

.hero__headline {
  color: var(--color-white);
  margin-bottom: var(--space-3);
}

.hero__sub {
  color: rgba(255, 255, 255, 0.78);
  font-size: 14px;
  line-height: 1.6;
  margin-bottom: var(--space-6);
  max-width: 480px;
}

/* ─── TRUST BAR ───────────────────────────────────────── */
.trust-bar {
  background: var(--color-navy-dark);
  padding: var(--space-4) 0;
}

.trust-bar__inner {
  display: flex;
  justify-content: space-around;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-4);
}

.trust-item { text-align: center; }

.trust-item__value {
  font-size: 18px;
  font-weight: 900;
  color: var(--color-lime);
  letter-spacing: -0.5px;
  display: block;
}

.trust-item__label {
  font-size: 10px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.55);
  text-transform: uppercase;
  letter-spacing: 0.8px;
}

/* ─── STEP LIST ───────────────────────────────────────── */
.step-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.step {
  display: flex;
  gap: var(--space-4);
  align-items: flex-start;
}

.step__num {
  width: 32px;
  height: 32px;
  background: var(--color-navy);
  color: var(--color-white);
  border-radius: 50%;
  font-size: 13px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.step__body {}

.step__title {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-navy-body);
  margin-bottom: 2px;
}

.step__desc {
  font-size: 13px;
  color: var(--color-navy-muted);
  line-height: 1.55;
}

/* ─── COMMITMENTS GRID ────────────────────────────────── */
.commitments-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-4);
}

@media (min-width: 640px) {
  .commitments-grid { grid-template-columns: repeat(2, 1fr); }
}

.commitment-card {
  background: var(--color-white);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  padding: var(--space-6);
}

.commitment-card__title {
  font-size: 14px;
  font-weight: 800;
  color: var(--color-navy);
  margin-bottom: var(--space-2);
}

.commitment-card__desc {
  font-size: 13px;
  color: var(--color-navy-muted);
  line-height: 1.55;
}

/* ─── TESTIMONIALS ────────────────────────────────────── */
.testimonials-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-4);
}

@media (min-width: 640px) {
  .testimonials-grid { grid-template-columns: repeat(2, 1fr); }
}

@media (min-width: 1024px) {
  .testimonials-grid { grid-template-columns: repeat(3, 1fr); }
}

.testimonial-card {
  background: var(--color-off-white);
  border-radius: var(--radius-card);
  padding: var(--space-6);
  border: 1px solid var(--color-border);
}

.testimonial-card__quote {
  font-size: 13px;
  line-height: 1.6;
  color: var(--color-navy-body);
  margin-bottom: var(--space-4);
  font-style: italic;
}

.testimonial-card__author {
  font-size: 12px;
  font-weight: 700;
  color: var(--color-navy);
}

/* ─── LISTING DETAIL ──────────────────────────────────── */
.listing-layout {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-6);
  padding: var(--space-8) 0;
}

@media (min-width: 1024px) {
  .listing-layout {
    grid-template-columns: 1fr 320px;
    align-items: start;
  }
}

.listing-sidebar {
  position: sticky;
  top: var(--space-6);
}

.listing-price-card {
  background: var(--color-navy-dark);
  color: var(--color-white);
  border-radius: var(--radius-card);
  padding: var(--space-6);
  margin-bottom: var(--space-4);
}

.listing-price__monthly {
  font-size: 36px;
  font-weight: 900;
  letter-spacing: -1.5px;
  color: var(--color-lime);
  line-height: 1;
}

.listing-price__sub {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  margin-top: var(--space-1);
  margin-bottom: var(--space-6);
}

.listing-section {
  background: var(--color-white);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  padding: var(--space-4) var(--space-6);
  margin-bottom: var(--space-4);
}

.listing-section__heading {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  color: var(--color-navy-muted);
  margin-bottom: var(--space-3);
  padding-bottom: var(--space-2);
  border-bottom: 1px solid var(--color-border);
}

.listing-table {
  width: 100%;
  border-collapse: collapse;
}

.listing-table tr {
  border-bottom: 1px solid var(--color-border);
}

.listing-table tr:last-child { border-bottom: none; }

.listing-table td {
  padding: var(--space-2) 0;
  font-size: 13px;
  vertical-align: top;
}

.listing-table td:first-child {
  color: var(--color-navy-muted);
  width: 50%;
  font-weight: 500;
}

.listing-table td:last-child {
  color: var(--color-navy-body);
  font-weight: 600;
}

/* ─── PHOTO STRIP ─────────────────────────────────────── */
.photo-strip {
  display: flex;
  gap: var(--space-2);
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  border-radius: var(--radius-card);
}

.photo-strip img {
  flex-shrink: 0;
  width: 85%;
  max-width: 400px;
  aspect-ratio: 4 / 3;
  object-fit: cover;
  scroll-snap-align: start;
  border-radius: var(--radius-card);
}

@media (min-width: 640px) {
  .photo-strip {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    overflow-x: visible;
  }

  .photo-strip img {
    width: 100%;
    max-width: none;
  }
}

/* ─── DISCLAIMER ──────────────────────────────────────── */
.disclaimer {
  background: var(--color-off-white);
  border-left: 3px solid var(--color-lime);
  border-radius: 0 var(--radius-card) var(--radius-card) 0;
  padding: var(--space-4) var(--space-6);
  font-size: 12px;
  line-height: 1.65;
  color: var(--color-navy-muted);
  margin-bottom: var(--space-4);
}

/* ─── MAP ─────────────────────────────────────────────── */
#property-map {
  height: 380px;
  width: 100%;
  border-radius: var(--radius-card);
  margin-bottom: var(--space-6);
  z-index: 0;
}

/* ─── FILTER BAR ──────────────────────────────────────── */
.filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-bottom: var(--space-6);
}

.filter-bar select {
  font-family: var(--font-family);
  font-size: 13px;
  font-weight: 600;
  color: var(--color-navy-body);
  background: var(--color-white);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-btn);
  padding: 8px 12px;
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%231F4C6B' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  padding-right: 28px;
}

/* ─── NAV ─────────────────────────────────────────────── */
.site-nav {
  background: var(--color-navy-dark);
  position: sticky;
  top: 0;
  z-index: 100;
}

.site-nav__inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  max-width: 1100px;
  margin: 0 auto;
}

.site-nav__logo img {
  height: 32px;
  width: auto;
  filter: brightness(0) invert(1);
}

.site-nav__links {
  display: none;
  gap: var(--space-6);
}

@media (min-width: 768px) {
  .site-nav__links { display: flex; }
}

.site-nav__links a {
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.75);
  transition: color 0.15s;
}

.site-nav__links a:hover { color: var(--color-white); }

.site-nav__phone {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-lime);
}

.site-nav__hamburger {
  display: flex;
  flex-direction: column;
  gap: 5px;
  cursor: pointer;
  padding: 4px;
}

@media (min-width: 768px) {
  .site-nav__hamburger { display: none; }
}

.site-nav__hamburger span {
  display: block;
  width: 22px;
  height: 2px;
  background: rgba(255, 255, 255, 0.75);
  border-radius: 2px;
}

/* Mobile nav drawer */
.site-nav__drawer {
  display: none;
  flex-direction: column;
  background: var(--color-navy-dark);
  padding: var(--space-4);
  gap: var(--space-4);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.site-nav__drawer.open { display: flex; }

.site-nav__drawer a {
  font-size: 15px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.8);
}

/* ─── FOOTER ──────────────────────────────────────────── */
.site-footer {
  background: var(--color-navy-dark);
  color: rgba(255, 255, 255, 0.65);
  padding: var(--space-12) 0 var(--space-8);
}

.site-footer__grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-8);
  margin-bottom: var(--space-8);
}

@media (min-width: 640px) {
  .site-footer__grid { grid-template-columns: 2fr 1fr 1fr 1fr; }
}

.site-footer__blurb {
  font-size: 13px;
  line-height: 1.6;
  margin-top: var(--space-3);
}

.site-footer__heading {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  color: var(--color-white);
  margin-bottom: var(--space-4);
}

.site-footer__links {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.site-footer__links a {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
  transition: color 0.15s;
}

.site-footer__links a:hover { color: var(--color-white); }

.site-footer__bottom {
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  padding-top: var(--space-6);
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-4);
  font-size: 12px;
}

.site-footer__legal {
  display: flex;
  gap: var(--space-4);
}

.site-footer__legal a { color: rgba(255, 255, 255, 0.45); }
.site-footer__legal a:hover { color: rgba(255, 255, 255, 0.8); }

/* ─── CTA SECTION ─────────────────────────────────────── */
.cta-section {
  background: var(--color-navy);
  color: var(--color-white);
  text-align: center;
  padding: var(--space-12) var(--space-4);
}

.cta-section .heading-lg { color: var(--color-white); margin-bottom: var(--space-3); }
.cta-section p { color: rgba(255, 255, 255, 0.7); margin-bottom: var(--space-6); max-width: 500px; margin-left: auto; margin-right: auto; }

/* ─── UTILITY ─────────────────────────────────────────── */
.text-center { text-align: center; }
.mt-2 { margin-top: var(--space-2); }
.mt-3 { margin-top: var(--space-3); }
.mt-4 { margin-top: var(--space-4); }
.mt-6 { margin-top: var(--space-6); }
.mb-4 { margin-bottom: var(--space-4); }
.mb-6 { margin-bottom: var(--space-6); }
```

- [ ] **Step 3.2: Verify the CSS file is valid (no syntax errors)**

```bash
node -e "const fs = require('fs'); const css = fs.readFileSync('assets/css/styles.css','utf8'); console.log('CSS lines:', css.split('\n').length, '— OK');"
```

Expected: prints line count, no error.

- [ ] **Step 3.3: Commit**

```bash
git add assets/css/styles.css
git commit -m "feat: add CSS design tokens and component styles"
git push
```

---

## Task 4: Logo and placeholder photo assets

**Files:**
- Create: `assets/images/logo.svg` (copy from iCloud)
- Create: `assets/properties/LTL-001/1.jpg`
- Create: `assets/properties/LTL-002/1.jpg`
- Create: `assets/properties/LTL-003/1.jpg`

- [ ] **Step 4.1: Copy the logo SVG**

```bash
cp "/Users/tyler/Library/Mobile Documents/com~apple~CloudDocs/Land to Land Holdings/Logos/Land to Land Logo Horizontal 1.svg" assets/images/logo.svg
```

- [ ] **Step 4.2: Download Unsplash placeholder photos**

```bash
curl -L "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=960&q=80&auto=format&fit=crop" \
  -o "assets/properties/LTL-001/1.jpg"

curl -L "https://images.unsplash.com/photo-1502786129293-79981df4e689?w=960&q=80&auto=format&fit=crop" \
  -o "assets/properties/LTL-002/1.jpg"

curl -L "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=960&q=80&auto=format&fit=crop" \
  -o "assets/properties/LTL-003/1.jpg"
```

Expected: three .jpg files, each several hundred KB.

- [ ] **Step 4.3: Verify files exist**

```bash
ls -lh assets/images/logo.svg assets/properties/LTL-001/1.jpg assets/properties/LTL-002/1.jpg assets/properties/LTL-003/1.jpg
```

Expected: all four files present with nonzero size.

- [ ] **Step 4.4: Commit**

```bash
git add assets/images/logo.svg "assets/properties/LTL-001/1.jpg" "assets/properties/LTL-002/1.jpg" "assets/properties/LTL-003/1.jpg"
git commit -m "feat: add logo and Unsplash placeholder property photos"
git push
```

---

## Task 5: Base layout, nav, and footer

**Files:**
- Create: `src/_includes/base.njk`
- Create: `src/_includes/partials/nav.njk`
- Create: `src/_includes/partials/footer.njk`

- [ ] **Step 5.1: Create `src/_includes/partials/nav.njk`**

```njk
<nav class="site-nav">
  <div class="site-nav__inner">
    <a href="/" class="site-nav__logo" aria-label="Land to Land Holdings home">
      <img src="/assets/images/logo.svg" alt="Land to Land Holdings" width="160" height="32">
    </a>
    <div class="site-nav__links">
      <a href="/properties/">Property Map</a>
      <a href="/how-it-works/">How It Works</a>
      <a href="/about/">About Us</a>
      <a href="/make-a-payment/">Make a Payment</a>
    </div>
    <a href="tel:6783361879" class="site-nav__phone">678-336-1879</a>
    <button class="site-nav__hamburger" aria-label="Open menu" onclick="document.getElementById('nav-drawer').classList.toggle('open')">
      <span></span><span></span><span></span>
    </button>
  </div>
  <div class="site-nav__drawer" id="nav-drawer">
    <a href="/properties/">Property Map</a>
    <a href="/how-it-works/">How It Works</a>
    <a href="/about/">About Us</a>
    <a href="/make-a-payment/">Make a Payment</a>
    <a href="tel:6783361879">678-336-1879</a>
  </div>
</nav>
```

- [ ] **Step 5.2: Create `src/_includes/partials/footer.njk`**

```njk
<footer class="site-footer">
  <div class="container">
    <div class="site-footer__grid">
      <div>
        <img src="/assets/images/logo.svg" alt="Land to Land Holdings" width="140" height="28" style="filter:brightness(0) invert(1);opacity:0.7;">
        <p class="site-footer__blurb">Land to Land Holdings has helped hundreds of buyers secure their ideal properties.</p>
      </div>
      <div>
        <p class="site-footer__heading">Navigation</p>
        <ul class="site-footer__links">
          <li><a href="/properties/">Property Map</a></li>
          <li><a href="/about/">About Us</a></li>
          <li><a href="/make-a-payment/">Make a Payment</a></li>
        </ul>
      </div>
      <div>
        <p class="site-footer__heading">Information</p>
        <ul class="site-footer__links">
          <li><a href="/how-it-works/">How It Works</a></li>
          <li><a href="/about/#contact">Contact Us</a></li>
        </ul>
      </div>
      <div>
        <p class="site-footer__heading">Contact</p>
        <ul class="site-footer__links">
          <li>2870 Peachtree Rd NW #915-8271</li>
          <li>Atlanta, GA 30305</li>
          <li><a href="mailto:info@landtolandholdings.com">info@landtolandholdings.com</a></li>
          <li><a href="tel:6783361879">678-336-1879</a></li>
        </ul>
      </div>
    </div>
    <div class="site-footer__bottom">
      <span>© {{ "" | date: "%Y" | default: "2026" }}. Land to Land Holdings. All rights reserved.</span>
      <div class="site-footer__legal">
        <a href="/terms/">Terms and Conditions</a>
        <a href="/privacy/">Privacy Policy</a>
      </div>
    </div>
  </div>
</footer>
```

- [ ] **Step 5.3: Create `src/_includes/base.njk`**

```njk
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{ title or "Land to Land Holdings — Owner-Financed Land" }}</title>
  <meta name="description" content="{{ description or "Buy vacant land with no bank and no credit check. Simple monthly payments direct from Tyler at Land to Land Holdings." }}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/assets/css/styles.css">
  <!-- GHL TRACKING SCRIPT -->
</head>
<body>
  {% include "partials/nav.njk" %}
  {{ content | safe }}
  {% include "partials/footer.njk" %}
  <!-- GHL CHAT WIDGET -->
</body>
</html>
```

- [ ] **Step 5.4: Create a minimal smoke-test page to verify the build works**

Create `src/index.njk` (temporary — will be replaced in Task 6):

```njk
---
layout: base.njk
title: Land to Land Holdings
---
<main><div class="container section"><h1 class="heading-lg">Build test</h1></div></main>
```

- [ ] **Step 5.5: Build and verify**

```bash
npm run build
```

Expected: `_site/index.html` exists. Open it and confirm the nav and footer render.

```bash
grep -c "site-nav" _site/index.html
```

Expected: output `2` or more (nav appears in header).

- [ ] **Step 5.6: Commit**

```bash
git add src/_includes/ src/index.njk
git commit -m "feat: add base layout, nav, and footer"
git push
```

---

## Task 6: Home page

**Files:**
- Modify: `src/index.njk` (replace temporary content)

- [ ] **Step 6.1: Replace `src/index.njk` with the full Home page**

```njk
---
layout: base.njk
title: "Land to Land Holdings — Owner-Financed Vacant Land"
description: "Browse owner-financed vacant land with no bank and no credit check. Simple monthly payments. Work directly with Tyler."
---

{# ── HERO ── #}
<section class="hero">
  <img class="hero__bg" src="https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=1600&q=80&auto=format&fit=crop" alt="Open land landscape" fetchpriority="high">
  <div class="hero__overlay"></div>
  <div class="hero__content">
    <div class="container">
      <p class="eyebrow hero__eyebrow">Owner-Financed Vacant Land</p>
      <h1 class="display hero__headline">Your Perfect Piece<br>of Land Starts Here</h1>
      <p class="hero__sub">No banks, no credit checks. Work directly with Tyler, who helps you find the right property and guides you every step of the way.</p>
      <a href="/properties/" class="btn btn-primary">Explore Our Properties</a>
    </div>
  </div>
</section>

{# ── TRUST BAR ── #}
<div class="trust-bar">
  <div class="container">
    <div class="trust-bar__inner">
      <div class="trust-item">
        <span class="trust-item__value">$0</span>
        <span class="trust-item__label">Bank Required</span>
      </div>
      <div class="trust-item">
        <span class="trust-item__value">No</span>
        <span class="trust-item__label">Credit Check</span>
      </div>
      <div class="trust-item">
        <span class="trust-item__value">30 Day</span>
        <span class="trust-item__label">Refund Policy</span>
      </div>
      <div class="trust-item">
        <span class="trust-item__value">Direct</span>
        <span class="trust-item__label">From Tyler</span>
      </div>
    </div>
  </div>
</div>

{# ── HOW IT WORKS SUMMARY ── #}
<section class="section">
  <div class="container">
    <p class="eyebrow" style="color:var(--color-lime-tint-text);margin-bottom:var(--space-2);">Simple Process</p>
    <h2 class="heading-lg mb-6">Making land ownership simple and personal</h2>
    <p class="mb-6" style="max-width:600px;color:var(--color-navy-muted);">Owning land is easy. No banks, no credit checks, and no red tape. Work directly with Tyler, who helps you find the right property and guides you every step of the way.</p>
    <div class="step-list" style="max-width:600px;">
      <div class="step">
        <div class="step__num">1</div>
        <div class="step__body">
          <p class="step__title">Explore available properties</p>
          <p class="step__desc">Browse our growing selection of land listings. Each property includes clear photos, maps, and key details so you can find one that fits your goals.</p>
        </div>
      </div>
      <div class="step">
        <div class="step__num">2</div>
        <div class="step__body">
          <p class="step__title">Speak with a real person</p>
          <p class="step__desc">Whether you call, email, or text, you'll connect with someone who's ready to help you explore your options. No automated replies, just real support.</p>
        </div>
      </div>
      <div class="step">
        <div class="step__num">3</div>
        <div class="step__body">
          <p class="step__title">Easy, flexible payments</p>
          <p class="step__desc">Our in-house financing means no banks or credit checks. Just simple, affordable monthly payments that make owning land possible for anyone.</p>
        </div>
      </div>
      <div class="step">
        <div class="step__num">4</div>
        <div class="step__body">
          <p class="step__title">Own your piece of freedom</p>
          <p class="step__desc">We handle the paperwork and make the process hassle-free. Before you know it, you'll officially own real, tangible land you can stand on and call your own.</p>
        </div>
      </div>
    </div>
  </div>
</section>

{# ── COMMITMENTS ── #}
<section class="section section-off">
  <div class="container">
    <p class="eyebrow text-center mb-4" style="color:var(--color-lime-tint-text);">Our Commitments to You</p>
    <h2 class="heading-lg text-center mb-6">What you can expect from us</h2>
    <p class="text-center mb-6" style="max-width:560px;margin-left:auto;margin-right:auto;color:var(--color-navy-muted);">Providing a simple, honest, and worry-free land buying experience. Every property comes with clear details, flexible payment options, fair pricing, and a 30-day satisfaction guarantee.</p>
    <div class="commitments-grid">
      <div class="commitment-card">
        <p class="commitment-card__title">Transparent Listings</p>
        <p class="commitment-card__desc">All property details are clearly shown so you know exactly what you're buying.</p>
      </div>
      <div class="commitment-card">
        <p class="commitment-card__title">Flexible Options</p>
        <p class="commitment-card__desc">Choose from easy payment plans designed to fit your budget and goals.</p>
      </div>
      <div class="commitment-card">
        <p class="commitment-card__title">Price Match Guarantee</p>
        <p class="commitment-card__desc">Found a similar property for less? We'll match the price to ensure you get the best deal.</p>
      </div>
      <div class="commitment-card">
        <p class="commitment-card__title">30 Day Returns/Refund</p>
        <p class="commitment-card__desc">Change your mind? Enjoy peace of mind with our 30-day return and refund policy.</p>
      </div>
    </div>
  </div>
</section>

{# ── SUCCESS STORIES ── #}
<section class="section">
  <div class="container">
    <p class="eyebrow text-center mb-4" style="color:var(--color-lime-tint-text);">Customer Success Stories</p>
    <h2 class="heading-lg text-center mb-6">The latest case studies of new landowners!</h2>
    <div class="testimonials-grid">
      <div class="testimonial-card">
        <p class="testimonial-card__quote">"Tyler was incredibly kind, informative, and made sure everything was stress free from start to finish. I felt confident and supported the whole way through."</p>
        <p class="testimonial-card__author">B. Edris</p>
        <p class="caption mt-2">Stress free from start to finish</p>
      </div>
      <div class="testimonial-card">
        <p class="testimonial-card__quote">"Tom purchased land in Ashley County, AR and couldn't be happier. The process was straightforward and Tyler was available every step of the way."</p>
        <p class="testimonial-card__author">Tom</p>
        <p class="caption mt-2">Location: Ashley County, AR</p>
      </div>
      <div class="testimonial-card">
        <p class="testimonial-card__quote">"Kevin and Jesica found the land they had been dreaming of in Etowah County, AL. Easy financing made it possible without any bank involvement."</p>
        <p class="testimonial-card__author">Kevin and Jesica</p>
        <p class="caption mt-2">Location: Etowah County, AL</p>
      </div>
    </div>
  </div>
</section>

{# ── CLOSING CTA ── #}
<section class="cta-section">
  <h2 class="heading-lg">Your Land Is Waiting!</h2>
  <p>With a wide selection of properties across the U.S., you're sure to find your perfect match.</p>
  <a href="/properties/" class="btn btn-primary">Find Property</a>
</section>
```

- [ ] **Step 6.2: Build and verify the home page renders**

```bash
npm run build && grep -c "Your Perfect Piece" _site/index.html
```

Expected: output `1`.

```bash
grep -c "Transparent Listings" _site/index.html
```

Expected: output `1`.

- [ ] **Step 6.3: Commit**

```bash
git add src/index.njk
git commit -m "feat: build home page with hero, trust bar, how it works, commitments, testimonials"
git push
```

---

## Task 7: Property card partial and map page

**Files:**
- Create: `src/_includes/partials/property-card.njk`
- Create: `src/properties.njk`
- Create: `assets/js/map.js`

- [ ] **Step 7.1: Create `src/_includes/partials/property-card.njk`**

```njk
{# Usage: {% include "partials/property-card.njk" %} with `prop` in scope #}
<article class="property-card"
  data-state="{{ prop.state }}"
  data-county="{{ prop.county }}"
  data-status="{{ prop.status }}">
  <a href="/property/{{ prop.slug }}/" class="property-card__photo">
    <img
      src="{{ prop.photos[0] }}"
      alt="{{ prop.acreage }} acre property in {{ prop.county }}, {{ prop.state }}"
      loading="lazy"
      width="480"
      height="270">
  </a>
  <div class="property-card__body">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-1);">
      <span class="badge badge-{{ prop.status | lower | replace(' ', '-') | replace('under-contract', 'contract') }}">{{ prop.status }}</span>
      <span class="caption">{{ prop.id }}</span>
    </div>
    <p class="property-card__price">${{ prop.monthly }}<span>/mo</span></p>
    <p class="property-card__meta">{{ prop.acreage }} ac · {{ prop.county }} Co, {{ prop.state }}</p>
    <a href="/property/{{ prop.slug }}/" class="btn btn-outline btn-full mt-3" style="font-size:12px;padding:8px 14px;">View Details</a>
  </div>
</article>
```

- [ ] **Step 7.2: Create `assets/js/map.js`**

```js
(function () {
  const props = window.PROPERTIES || [];
  if (!props.length) return;

  // Center map on the average of all property coords
  const avgLat = props.reduce((s, p) => s + p.lat, 0) / props.length;
  const avgLng = props.reduce((s, p) => s + p.lng, 0) / props.length;

  const map = L.map("property-map").setView([avgLat, avgLng], 4);

  L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    { attribution: "Esri World Imagery" }
  ).addTo(map);

  props.forEach(function (p) {
    if (!p.lat || !p.lng) return;

    var marker = L.circleMarker([p.lat, p.lng], {
      radius: 12,
      fillColor: "#8BC83F",
      color: "#0D2600",
      weight: 2,
      opacity: 1,
      fillOpacity: 0.9,
    });

    marker.bindPopup(
      '<strong style="color:#1F4C6B;">$' +
        p.monthly +
        '/mo</strong><br>' +
        p.acreage +
        " ac · " +
        p.county +
        " Co, " +
        p.state +
        '<br><a href="/property/' +
        p.slug +
        '/" style="color:#1F4C6B;font-weight:700;">View Listing &rarr;</a>'
    );

    marker.addTo(map);
  });

  // Filter integration: re-render map markers on filter change
  document.querySelectorAll(".filter-bar select").forEach(function (sel) {
    sel.addEventListener("change", function () {
      var state = document.getElementById("filter-state").value;
      var county = document.getElementById("filter-county").value;
      var status = document.getElementById("filter-status").value;

      document.querySelectorAll(".property-card").forEach(function (card) {
        var show =
          (!state || card.dataset.state === state) &&
          (!county || card.dataset.county === county) &&
          (!status || card.dataset.status === status);
        card.style.display = show ? "" : "none";
      });
    });
  });
})();
```

- [ ] **Step 7.3: Create `src/properties.njk`**

```njk
---
layout: base.njk
title: "Property Map — Land to Land Holdings"
description: "Browse available owner-financed land across Florida, New Mexico, and Oregon. Filter by state, county, and availability."
---

<section class="section">
  <div class="container">
    <p class="eyebrow mb-2" style="color:var(--color-lime-tint-text);">Browse Listings</p>
    <h1 class="heading-lg mb-6">Property Map</h1>

    {# Leaflet CSS #}
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="">

    {# Map container #}
    <div id="property-map" role="region" aria-label="Property locations map"></div>

    {# Filter bar #}
    <div class="filter-bar" role="search" aria-label="Filter properties">
      <select id="filter-state" aria-label="Filter by state">
        <option value="">All States</option>
        <option value="FL">Florida</option>
        <option value="NM">New Mexico</option>
        <option value="OR">Oregon</option>
      </select>
      <select id="filter-county" aria-label="Filter by county">
        <option value="">All Counties</option>
        <option value="Putnam">Putnam (FL)</option>
        <option value="Luna">Luna (NM)</option>
        <option value="Klamath">Klamath (OR)</option>
      </select>
      <select id="filter-status" aria-label="Filter by availability">
        <option value="">All Listings</option>
        <option value="Active">Available</option>
        <option value="Under Contract">Under Contract</option>
        <option value="Sold">Sold</option>
      </select>
    </div>

    {# Property card grid #}
    <div class="card-grid">
      {% for prop in properties %}
        {% include "partials/property-card.njk" %}
      {% endfor %}
    </div>
  </div>
</section>

{# Inject properties for map + filter JS #}
<script>window.PROPERTIES = {{ properties | json | safe }};</script>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV/XN/WsQI=" crossorigin=""></script>
<script src="/assets/js/map.js"></script>
```

- [ ] **Step 7.4: Build and verify the properties page**

```bash
npm run build && grep -c "property-map" _site/properties/index.html
```

Expected: output `1`.

```bash
grep -c "LTL-001" _site/properties/index.html
```

Expected: `2` or more (appears in card markup).

- [ ] **Step 7.5: Commit**

```bash
git add src/_includes/partials/property-card.njk src/properties.njk assets/js/map.js
git commit -m "feat: add property card partial, map page, and Leaflet integration"
git push
```

---

## Task 8: Listing detail template

**Files:**
- Create: `src/property/property.njk`

- [ ] **Step 8.1: Write the build test for listing pages first**

Create `tests/build.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

// Run: npm run test:build (builds first, then runs this file)

test("_site/index.html exists", () => {
  assert.ok(existsSync("_site/index.html"), "_site/index.html missing");
});

test("_site/properties/index.html exists", () => {
  assert.ok(existsSync("_site/properties/index.html"), "_site/properties/index.html missing");
});

const slugs = [
  "5-acre-satsuma-putnam-fl-ltl-001",
  "10-acre-deming-luna-nm-ltl-002",
  "2-acre-klamath-falls-klamath-or-ltl-003",
];

for (const slug of slugs) {
  test(`listing page exists for ${slug}`, () => {
    assert.ok(
      existsSync(`_site/property/${slug}/index.html`),
      `_site/property/${slug}/index.html missing`
    );
  });
}

test("LTL-002 (Under Contract, null geekpay_url) has no buy button", () => {
  const html = readFileSync(
    "_site/property/10-acre-deming-luna-nm-ltl-002/index.html",
    "utf8"
  );
  assert.ok(!html.includes('class="btn-buy"'), "LTL-002 must not render a buy button");
});

test("LTL-001 (Active, has geekpay_url) renders a buy button", () => {
  const html = readFileSync(
    "_site/property/5-acre-satsuma-putnam-fl-ltl-001/index.html",
    "utf8"
  );
  assert.ok(html.includes('class="btn-buy"'), "LTL-001 must render a buy button");
});

test("_site/sitemap.xml exists", () => {
  assert.ok(existsSync("_site/sitemap.xml"), "_site/sitemap.xml missing");
});

test("_site/robots.txt exists", () => {
  assert.ok(existsSync("_site/robots.txt"), "_site/robots.txt missing");
});

test("_site/404.html exists", () => {
  assert.ok(existsSync("_site/404.html"), "_site/404.html missing");
});
```

- [ ] **Step 8.2: Run the build test — verify it fails (listing pages don't exist yet)**

```bash
npm run test:build 2>&1 | head -30
```

Expected: multiple FAIL — listing pages not found.

- [ ] **Step 8.3: Create `src/property/property.njk`**

```njk
---
pagination:
  data: properties
  size: 1
  alias: prop
permalink: "property/{{ prop.slug }}/index.html"
layout: base.njk
---
{%- set title = prop.acreage + " Acre Property in " + prop.county + ", " + prop.state + " — Land to Land Holdings" -%}
{%- set description = prop.description -%}

<main>
  <div class="container">
    <div class="listing-layout">

      {# ── MAIN COLUMN ── #}
      <div>

        {# Status badge + heading #}
        <div style="padding:var(--space-6) 0 var(--space-4);">
          <span class="badge badge-{{ prop.status | lower | replace(' ', '-') | replace('under-contract', 'contract') }}">{{ prop.status }}</span>
          <h1 class="heading-lg mt-3">{{ prop.acreage }} Acre Property in {{ prop.county }}, {{ prop.state }}</h1>
          <p class="caption mt-2">Property ID: {{ prop.id }} · APN: {{ prop.apn }}</p>
        </div>

        {# Photo strip #}
        <div class="photo-strip mb-6">
          {% for photo in prop.photos %}
            <img src="{{ photo }}" alt="{{ prop.acreage }} acre property in {{ prop.county }}, {{ prop.state }}" loading="{{ 'eager' if loop.first else 'lazy' }}" width="960" height="720">
          {% endfor %}
        </div>

        {# Description #}
        <div class="listing-section">
          <p class="listing-section__heading">Description</p>
          <p>{{ prop.description }}</p>
        </div>

        {# Location #}
        <div class="listing-section">
          <p class="listing-section__heading">Location</p>
          <table class="listing-table">
            <tr><td>Property ID</td><td>{{ prop.id }}</td></tr>
            <tr><td>Street Address</td><td>{{ prop.address }}</td></tr>
            <tr><td>City</td><td>{{ prop.city }}</td></tr>
            <tr><td>County</td><td>{{ prop.county }}</td></tr>
            <tr><td>State</td><td>{{ prop.state }}</td></tr>
            <tr><td>GPS Coordinates</td><td>{{ prop.gps }}</td></tr>
            <tr><td>Google Maps</td><td><a href="{{ prop.google_maps_url }}" target="_blank" rel="noopener" style="color:var(--color-navy);font-weight:700;">Open in Maps</a></td></tr>
          </table>
        </div>

        {# Property Specifics #}
        <div class="listing-section">
          <p class="listing-section__heading">Property Specifics</p>
          <table class="listing-table">
            <tr><td>APN</td><td>{{ prop.apn }}</td></tr>
            {% if prop.subdivision %}<tr><td>Subdivision</td><td>{{ prop.subdivision }}</td></tr>{% endif %}
            {% if prop.short_legal %}<tr><td>Short Legal</td><td>{{ prop.short_legal }}</td></tr>{% endif %}
            <tr><td>Zoning</td><td>{{ prop.zoning }}</td></tr>
            <tr><td>Annual Taxes</td><td>${{ prop.annual_taxes }}</td></tr>
          </table>
        </div>

        {# Property Characteristics #}
        <div class="listing-section">
          <p class="listing-section__heading">Property Characteristics</p>
          <table class="listing-table">
            <tr><td>Acreage</td><td>{{ prop.acreage_display }}</td></tr>
            <tr><td>Elevation</td><td>{{ prop.elevation }}</td></tr>
            <tr><td>Terrain</td><td>{{ prop.terrain }}</td></tr>
            <tr><td>Lot Dimensions</td><td>{{ prop.lot_dimensions }}</td></tr>
          </table>
        </div>

        {# Building Information #}
        <div class="listing-section">
          <p class="listing-section__heading">Building Information</p>
          <div class="disclaimer">
            READ THIS: We are not the Planning and Zoning department and while we try to answer common questions about what the property can be used for, we can't provide a yes or no answer for every circumstance. Below we provide helpful contact information to complete due diligence. Land to Land Holdings LLC or its affiliates make no warranty or guarantee, either expressed or implied relative to usability, the exact location, desirability, or usefulness of the properties or boundary lines of the properties. Buyer is solely responsible for determining the condition of the property, the physical aspects of the land, its geographical location, accessibility, and correct acreage. All information contained herein is deemed reliable but not guaranteed. Buyer is required to complete Buyer's own due diligence prior to purchasing any property from Land to Land Holdings LLC or its affiliates.
          </div>
          <table class="listing-table">
            <tr><td>Time Limit to Build</td><td>{{ prop.time_limit_to_build }}</td></tr>
            <tr><td>Single Family Homes</td><td>{{ prop.single_family_allowed }}</td></tr>
            <tr><td>Modular Homes</td><td>{{ prop.modular_allowed }}</td></tr>
            <tr><td>Manufactured Homes</td><td>{{ prop.manufactured_allowed }}</td></tr>
            <tr><td>Tiny Home Friendly</td><td>{{ prop.tiny_home_friendly }}</td></tr>
            <tr><td>Septic Required to Build</td><td>{{ prop.septic_required }}</td></tr>
            <tr><td>Flood Plain</td><td>{{ prop.flood_plain }}</td></tr>
          </table>
        </div>

        {# Allowable Uses #}
        <div class="listing-section">
          <p class="listing-section__heading">Allowable Uses</p>
          <table class="listing-table">
            <tr><td>Full-Time RV Living</td><td>{{ prop.full_time_rv }}</td></tr>
            <tr><td>RV While You Build</td><td>{{ prop.rv_while_build }}</td></tr>
            <tr><td>Camping in RV</td><td>{{ prop.camping_rv }}</td></tr>
            <tr><td>Tent Camping</td><td>{{ prop.tent_camping }}</td></tr>
            <tr><td>Hunting Allowed</td><td>{{ prop.hunting }}</td></tr>
          </table>
        </div>

        {# Utilities #}
        <div class="listing-section">
          <p class="listing-section__heading">Utilities</p>
          <table class="listing-table">
            <tr><td>Water/Well</td><td>{{ prop.well }}</td></tr>
            <tr><td>Sewer/Septic</td><td>{{ prop.septic }}</td></tr>
            <tr><td>Electricity</td><td>{{ prop.electricity }}</td></tr>
            <tr><td>Solar</td><td>{{ prop.solar }}</td></tr>
            <tr><td>Propane</td><td>{{ prop.propane }}</td></tr>
            <tr><td>Gas</td><td>{{ prop.gas }}</td></tr>
          </table>
        </div>

      </div>{# end main column #}

      {# ── SIDEBAR ── #}
      <aside class="listing-sidebar">
        <div class="listing-price-card">
          <p class="listing-price__monthly">${{ prop.monthly }}<span style="font-size:18px;font-weight:600;color:rgba(255,255,255,0.6)">/mo</span></p>
          <p class="listing-price__sub">${{ prop.down }} down + ${{ prop.doc_fee }} doc fee</p>
          {% if prop.cash_price %}
            <p style="font-size:12px;color:rgba(255,255,255,0.45);margin-bottom:var(--space-6);">Cash price: ${{ prop.cash_price | number }}</p>
          {% endif %}

          {% if prop.geekpay_url and prop.status === "Active" %}
            <a href="{{ prop.geekpay_url }}" target="_blank" rel="noopener" class="btn btn-primary btn-full btn-buy mb-4">Buy Now</a>
          {% endif %}

          <a href="#ask-question" class="btn btn-secondary btn-full">Ask a Question</a>
        </div>

        {# Ask a question stub #}
        <div id="ask-question" class="listing-section">
          <p class="listing-section__heading">Ask a Question</p>
          <p style="font-size:13px;color:var(--color-navy-muted);margin-bottom:var(--space-4);">Have questions about this property? Contact Tyler directly.</p>
          <!-- GHL FORM EMBED -->
          <a href="tel:6783361879" class="btn btn-outline btn-full">Call 678-336-1879</a>
        </div>
      </aside>

    </div>
  </div>
</main>
```

- [ ] **Step 8.4: Run the build test — verify all tests pass**

```bash
npm run test:build
```

Expected: all tests PASS including listing page existence and buy button rules.

- [ ] **Step 8.5: Commit**

```bash
git add src/property/property.njk tests/build.test.mjs
git commit -m "feat: add listing detail template with pagination, buy button logic, all sections"
git push
```

---

## Task 9: How It Works page

**Files:**
- Create: `src/how-it-works.njk`

- [ ] **Step 9.1: Create `src/how-it-works.njk`**

```njk
---
layout: base.njk
title: "How It Works — Land to Land Holdings"
description: "Learn how Land to Land Holdings makes buying vacant land simple, affordable, and direct. No banks, no credit checks, six easy steps."
---

<section class="hero" style="min-height:320px;">
  <img class="hero__bg" src="https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1600&q=80&auto=format&fit=crop" alt="Open landscape" fetchpriority="high">
  <div class="hero__overlay"></div>
  <div class="hero__content">
    <div class="container">
      <p class="eyebrow hero__eyebrow">Simple and Personal</p>
      <h1 class="display hero__headline">Finding Your Perfect<br>Property Made Simple</h1>
      <p class="hero__sub">With hundreds of properties available across the U.S., discovering the right piece of land has never been easier.</p>
    </div>
  </div>
</section>

<section class="section">
  <div class="container" style="max-width:720px;">
    <p style="font-size:15px;line-height:1.7;color:var(--color-navy-muted);margin-bottom:var(--space-8);">At Land to Land Holdings, we've eliminated the traditional barriers to land ownership. Our process is designed to make purchasing land straightforward and accessible. No banks, no credit checks, and no complicated red tape. We believe everyone deserves the opportunity to own their own piece of land with affordable options and direct communication every step of the way.</p>

    <div class="step-list">
      <div class="step">
        <div class="step__num">1</div>
        <div class="step__body">
          <p class="step__title">Browse Available Properties</p>
          <p class="step__desc">Explore our current land listings on our website or contact us directly to discuss what you're looking for. Each property listing includes details about location, size, and pricing information.</p>
        </div>
      </div>
      <div class="step">
        <div class="step__num">2</div>
        <div class="step__body">
          <p class="step__title">Connect With Us</p>
          <p class="step__desc">Reach out to us via email, text, or phone. We'll discuss the property that interests you, answer all your questions, and help you understand exactly what you're getting, a real, tangible asset you can see and stand on.</p>
        </div>
      </div>
      <div class="step">
        <div class="step__num">3</div>
        <div class="step__body">
          <p class="step__title">Review Your Options</p>
          <p class="step__desc">We'll provide you with transparent pricing and flexible payment options designed to fit your budget. No hidden fees, no complicated terms, just straightforward, affordable paths to land ownership.</p>
        </div>
      </div>
      <div class="step">
        <div class="step__num">4</div>
        <div class="step__body">
          <p class="step__title">Finalize Your Agreement</p>
          <p class="step__desc">Once you've found the right property, we'll prepare a simple agreement. No credit checks, no bank approvals, no red tape, just direct terms between you and us that make sense for your situation.</p>
        </div>
      </div>
      <div class="step">
        <div class="step__num">5</div>
        <div class="step__body">
          <p class="step__title">Complete Your Purchase</p>
          <p class="step__desc">Finalize the process on terms that work for you. We're here to guide you through every detail and ensure you feel confident about your investment.</p>
        </div>
      </div>
      <div class="step">
        <div class="step__num">6</div>
        <div class="step__body">
          <p class="step__title">Own Your Land</p>
          <p class="step__desc">Receive your deed and enjoy the freedom that comes with owning your own piece of land. Experience the peace, security, and possibilities that land ownership provides.</p>
        </div>
      </div>
    </div>
  </div>
</section>

<section class="section section-off">
  <div class="container" style="max-width:600px;text-align:center;">
    <h2 class="heading-lg mb-4">Ready to get started?</h2>
    <p style="color:var(--color-navy-muted);margin-bottom:var(--space-6);">Browse available properties or reach out to Tyler directly.</p>
    <div style="display:flex;gap:var(--space-4);justify-content:center;flex-wrap:wrap;">
      <a href="/properties/" class="btn btn-primary">Browse Properties</a>
      <a href="tel:6783361879" class="btn btn-outline">Call 678-336-1879</a>
    </div>
    <!-- GHL FORM EMBED -->
  </div>
</section>
```

- [ ] **Step 9.2: Build and verify**

```bash
npm run build && grep -c "Browse Available Properties" _site/how-it-works/index.html
```

Expected: output `1`.

- [ ] **Step 9.3: Commit**

```bash
git add src/how-it-works.njk
git commit -m "feat: add How It Works page with 6-step layout"
git push
```

---

## Task 10: About page

**Files:**
- Create: `src/about.njk`

- [ ] **Step 10.1: Create `src/about.njk`**

```njk
---
layout: base.njk
title: "About Us — Land to Land Holdings"
description: "Meet Tyler, owner of Land to Land Holdings. Learn about our mission, values, and 30-day satisfaction guarantee."
---

<section class="hero" style="min-height:280px;">
  <img class="hero__bg" src="https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1600&q=80&auto=format&fit=crop" alt="Mountain landscape" fetchpriority="high">
  <div class="hero__overlay"></div>
  <div class="hero__content">
    <div class="container">
      <p class="eyebrow hero__eyebrow">Hi, We're Land to Land Holdings!</p>
      <h1 class="display hero__headline">Welcome to<br>Land to Land Holdings LLC!</h1>
    </div>
  </div>
</section>

<section class="section">
  <div class="container" style="max-width:760px;">

    {# Video embed placeholder #}
    <div style="aspect-ratio:16/9;background:var(--color-off-white);border-radius:var(--radius-card);display:flex;align-items:center;justify-content:center;margin-bottom:var(--space-8);border:1px solid var(--color-border);">
      <!-- GHL / YouTube video embed: Tyler supplies URL -->
      <p style="color:var(--color-navy-muted);font-size:13px;">Video: Get to know me! I am Tyler, and I own Land to Land Holdings</p>
    </div>

    <h2 class="heading-md mb-4">I'm Tyler.</h2>
    <p style="margin-bottom:var(--space-6);color:var(--color-navy-muted);line-height:1.7;">I have a passion for turning your land ownership dreams into reality. Let's dive into why I'm all about helping you secure your very own slice of the great outdoors.</p>

    <h2 class="heading-md mb-4">Why Land, You Ask?</h2>
    <p style="margin-bottom:var(--space-6);color:var(--color-navy-muted);line-height:1.7;">Ever heard the phrase, "They're not making any more land"? Well, that got me thinking. What if we could make this limited resource work for you? Whether it's a cozy haven, an adventure spot, or a smart investment, I'm here to help you make it happen.</p>

  </div>
</section>

{# Core Values #}
<section class="section section-off">
  <div class="container">
    <p class="eyebrow text-center mb-4" style="color:var(--color-lime-tint-text);">What Drives Us</p>
    <h2 class="heading-lg text-center mb-6">Values That Make Us Tick</h2>
    <p class="text-center mb-6" style="max-width:600px;margin:0 auto var(--space-8);color:var(--color-navy-muted);">At Land to Land Holdings, we uphold integrity, transparency, and sustainability. We value the environment, build strong community partnerships, and follow responsible land practices that preserve natural beauty while creating opportunities for growth and prosperity.</p>
    <div class="commitments-grid">
      <div class="commitment-card">
        <p class="commitment-card__title">Honesty and Fairness</p>
        <p class="commitment-card__desc">We believe in keeping it real. Every deal is transparent, and every interaction is grounded in fairness. You deserve clarity and peace of mind, and that's exactly what we deliver.</p>
      </div>
      <div class="commitment-card">
        <p class="commitment-card__title">Connection and Care</p>
        <p class="commitment-card__desc">Business is more than transactions, it's about relationships. We guide you every step of the way, celebrating each milestone as you achieve your land ownership goals. You're not just a customer; you're part of the Land to Land family.</p>
      </div>
      <div class="commitment-card">
        <p class="commitment-card__title">Trust and Approachability</p>
        <p class="commitment-card__desc">We strive to make every interaction feel natural and genuine. Think of us as a friendly guide, approachable, reliable, and genuinely excited to help you secure your perfect property.</p>
      </div>
      <div class="commitment-card">
        <p class="commitment-card__title">Passion for Land</p>
        <p class="commitment-card__desc">Land is a limited resource, and we're passionate about helping you make it work for you, whether it's a cozy retreat, an adventurous getaway, or a smart investment. Your dreams are our mission.</p>
      </div>
    </div>
  </div>
</section>

{# Guarantee #}
<section class="section">
  <div class="container" style="max-width:680px;">
    <p class="eyebrow text-center mb-4" style="color:var(--color-lime-tint-text);">Our Promise</p>
    <h2 class="heading-lg text-center mb-4">Our Guarantee</h2>
    <div style="background:var(--color-navy-dark);border-radius:var(--radius-card);padding:var(--space-8);color:var(--color-white);">
      <p style="margin-bottom:var(--space-6);color:rgba(255,255,255,0.7);">At Land to Land Holdings LLC, buying land should be simple and stress-free. That's why we stand behind every property with our No-Risk Guarantee:</p>
      <ul style="display:flex;flex-direction:column;gap:var(--space-3);">
        <li style="display:flex;gap:var(--space-3);align-items:flex-start;font-size:14px;">
          <span style="color:var(--color-lime);font-weight:800;flex-shrink:0;">✓</span>
          <span><strong>100% Secure and Transparent Process</strong> — No hidden fees. No surprises.</span>
        </li>
        <li style="display:flex;gap:var(--space-3);align-items:flex-start;font-size:14px;">
          <span style="color:var(--color-lime);font-weight:800;flex-shrink:0;">✓</span>
          <span><strong>Easy Financing Options</strong> — Everyone qualifies. No credit check.</span>
        </li>
        <li style="display:flex;gap:var(--space-3);align-items:flex-start;font-size:14px;">
          <span style="color:var(--color-lime);font-weight:800;flex-shrink:0;">✓</span>
          <span><strong>30-Day Satisfaction Promise</strong> — If you're not happy, we'll work with you to make it right.</span>
        </li>
        <li style="display:flex;gap:var(--space-3);align-items:flex-start;font-size:14px;">
          <span style="color:var(--color-lime);font-weight:800;flex-shrink:0;">✓</span>
          <span><strong>We Handle the Paperwork</strong> — From contract to closing, we take care of everything.</span>
        </li>
      </ul>
    </div>
  </div>
</section>

{# Testimonials #}
<section class="section section-off">
  <div class="container">
    <p class="eyebrow text-center mb-4" style="color:var(--color-lime-tint-text);">Who Love Our Work</p>
    <h2 class="heading-lg text-center mb-6">What Buyers Are Saying</h2>
    <div class="testimonials-grid">
      <div class="testimonial-card">
        <p class="testimonial-card__quote">"Tyler was incredibly kind, informative, and made sure everything was stress free from start to finish. I felt confident and supported the whole way through."</p>
        <p class="testimonial-card__author">B. Edris</p>
      </div>
      <div class="testimonial-card">
        <p class="testimonial-card__quote">"The process was simple from start to finish. No banks, no hassle. Tyler walked me through everything and I now own land in Arkansas."</p>
        <p class="testimonial-card__author">Tom</p>
        <p class="caption mt-2">Ashley County, AR</p>
      </div>
      <div class="testimonial-card">
        <p class="testimonial-card__quote">"We always wanted land but thought we couldn't afford it. Land to Land made it possible with monthly payments we could actually manage."</p>
        <p class="testimonial-card__author">Kevin and Jesica</p>
        <p class="caption mt-2">Etowah County, AL</p>
      </div>
    </div>
  </div>
</section>
```

- [ ] **Step 10.2: Build and verify**

```bash
npm run build && grep -c "Values That Make Us Tick" _site/about/index.html
```

Expected: output `1`.

- [ ] **Step 10.3: Commit**

```bash
git add src/about.njk
git commit -m "feat: add About page with Tyler intro, values, guarantee, testimonials"
git push
```

---

## Task 11: Make a Payment, 404, and extras

**Files:**
- Create: `src/make-a-payment.njk`
- Create: `src/404.html`
- Create: `src/robots.txt`

- [ ] **Step 11.1: Create `src/make-a-payment.njk`**

```njk
---
layout: base.njk
title: "Make a Payment — Land to Land Holdings"
description: "Make a payment on your Land to Land Holdings property or contact us for help."
---

<section class="section">
  <div class="container" style="max-width:560px;text-align:center;">
    <p class="eyebrow mb-4" style="color:var(--color-lime-tint-text);">Existing Customers</p>
    <h1 class="heading-lg mb-4">Make a Payment</h1>
    <p style="color:var(--color-navy-muted);margin-bottom:var(--space-8);">Use the GeekPay buyer portal to make a payment on your property, or contact Tyler directly with any questions.</p>

    <div style="display:flex;flex-direction:column;gap:var(--space-4);max-width:320px;margin:0 auto;">
      {# GeekPay link — Tyler supplies URL before Phase 3 #}
      <a href="#" class="btn btn-primary btn-full">Go to Buyer Portal</a>
      <a href="tel:6783361879" class="btn btn-outline btn-full">Call 678-336-1879</a>
      <a href="mailto:info@landtolandholdings.com" class="btn btn-outline btn-full">Email Us</a>
    </div>
  </div>
</section>
```

- [ ] **Step 11.2: Create `src/404.html`**

```html
---
layout: base.njk
title: "Page Not Found — Land to Land Holdings"
permalink: 404.html
---

<section class="section">
  <div class="container" style="max-width:560px;text-align:center;">
    <p class="eyebrow mb-4" style="color:var(--color-lime-tint-text);">404</p>
    <h1 class="heading-lg mb-4">Page Not Found</h1>
    <p style="color:var(--color-navy-muted);margin-bottom:var(--space-8);">The page you're looking for doesn't exist. Try browsing our available properties or go back home.</p>
    <div style="display:flex;gap:var(--space-4);justify-content:center;flex-wrap:wrap;">
      <a href="/" class="btn btn-primary">Go Home</a>
      <a href="/properties/" class="btn btn-outline">Browse Properties</a>
    </div>
  </div>
</section>
```

- [ ] **Step 11.3: Create `src/robots.txt`**

```
User-agent: *
Allow: /

Sitemap: https://landtolandholdings.com/sitemap.xml
```

- [ ] **Step 11.4: Build and verify**

```bash
npm run build && ls _site/404.html _site/robots.txt
```

Expected: both files exist.

- [ ] **Step 11.5: Run the full build test suite**

```bash
npm run test:build
```

Expected: all tests PASS including sitemap.xml and robots.txt.

- [ ] **Step 11.6: Commit**

```bash
git add src/make-a-payment.njk src/404.html src/robots.txt
git commit -m "feat: add Make a Payment, 404, and robots.txt"
git push
```

---

## Task 12: Lighthouse and mobile verification

No new files. This task is verification only — do not skip it.

- [ ] **Step 12.1: Run the dev server**

```bash
npm run dev
```

Expected: Eleventy dev server starts, output shows "Server at http://localhost:8080/".

- [ ] **Step 12.2: Check every page loads without console errors**

Open each URL in Chrome and check the browser console (DevTools, Console tab). Fix any errors before continuing.

- `http://localhost:8080/`
- `http://localhost:8080/properties/`
- `http://localhost:8080/property/5-acre-satsuma-putnam-fl-ltl-001/`
- `http://localhost:8080/property/10-acre-deming-luna-nm-ltl-002/`
- `http://localhost:8080/property/2-acre-klamath-falls-klamath-or-ltl-003/`
- `http://localhost:8080/how-it-works/`
- `http://localhost:8080/about/`
- `http://localhost:8080/make-a-payment/`

- [ ] **Step 12.3: Verify LTL-002 has no Buy Now button**

Open `http://localhost:8080/property/10-acre-deming-luna-nm-ltl-002/` and confirm there is no "Buy Now" button in the sidebar. There should be only the "Ask a Question" button.

- [ ] **Step 12.4: Run Lighthouse on the home page (mobile)**

In Chrome DevTools: Lighthouse tab, select "Mobile", check "Performance" and "Accessibility". Run audit on `http://localhost:8080/`.

Required: Performance score above 90. Fix any issues before deploying.

Common issues and fixes:
- Images missing `width`/`height` attributes — add them to all `<img>` tags.
- Render-blocking resources — ensure Leaflet CSS only loads on `/properties/` (it's already scoped to that page's template).
- LCP (hero image) — the hero `<img>` already has `fetchpriority="high"`, confirm it is present.

- [ ] **Step 12.5: Run the full test suite one final time**

```bash
npm test && npm run test:build
```

Expected: all tests PASS.

- [ ] **Step 12.6: Commit**

```bash
git add -A
git commit -m "chore: verify all pages, Lighthouse > 90, all tests green"
git push
```

---

## Task 13: Cloudflare Pages setup and deployment

No new files. This task connects the GitHub repo to Cloudflare Pages.

- [ ] **Step 13.1: Log in to Cloudflare dashboard**

Go to `dash.cloudflare.com`, open the account, click **Pages** in the left nav.

- [ ] **Step 13.2: Create a new Pages project**

Click **Create a project**, select **Connect to Git**, authorize GitHub, and select the `land-to-land-website` repo.

- [ ] **Step 13.3: Configure build settings**

| Setting | Value |
|---|---|
| Framework preset | None |
| Build command | `npm run build` |
| Build output directory | `_site` |
| Root directory | `/` (leave blank) |
| Node.js version | 20 |

- [ ] **Step 13.4: Deploy**

Click **Save and Deploy**. Wait for the build to complete (usually 1-2 minutes).

Expected: Cloudflare shows "Success" with a preview URL like `https://land-to-land-website.pages.dev`.

- [ ] **Step 13.5: Verify the preview URL**

Open the CF Pages preview URL in a mobile browser (or Chrome DevTools mobile emulator at 390px width). Confirm:
- Home page hero image loads
- Nav hamburger opens the drawer
- `/properties/` shows the Leaflet map and all three property cards
- `/property/5-acre-satsuma-putnam-fl-ltl-001/` shows the Buy Now button
- `/property/10-acre-deming-luna-nm-ltl-002/` shows the Under Contract badge with no Buy Now button
- Footer renders correctly on all pages

- [ ] **Step 13.6: Record the preview URL**

Add the CF Pages preview URL to the repo README.md:

```markdown
# Land to Land Holdings Website

Phase 1 preview: https://land-to-land-website.pages.dev

Built with Eleventy. Deploys automatically on push to `main` via Cloudflare Pages.
```

```bash
git add README.md
git commit -m "docs: add CF Pages preview URL to README"
git push
```

**Phase 1 complete.** All six pages plus listing detail are live on the Cloudflare Pages preview URL. All tests green. Lighthouse performance above 90.

---

## Self-Review Checklist

Checked against spec `docs/superpowers/specs/2026-06-10-phase1-static-shell-design.md`:

| Spec requirement | Task |
|---|---|
| Eleventy 3.x | Task 1 |
| GitHub repo (private) | Task 1 |
| CF Pages connected, preview URL live | Task 13 |
| `dev`, `build`, `sync` (stub), `test` scripts | Task 1 |
| CSS design tokens, WCAG AAA rules | Task 3 |
| Logo SVG with CSS filter for nav | Tasks 4, 5 |
| Base layout with GHL stub comments | Task 5 |
| Nav (hamburger mobile, full desktop, phone) | Task 5 |
| Footer (3 columns, copyright, legal links) | Task 5 |
| Home: hero, trust bar, HIW, commitments, stories, CTA | Task 6 |
| Property Map: Leaflet + filter + card grid | Task 7 |
| Property card partial | Task 7 |
| Listing detail: Eleventy pagination, all sections | Task 8 |
| Planning and Zoning disclaimer verbatim | Task 8 |
| Buy Now hidden when geekpay_url is null | Task 8 |
| Under Contract badge, no buy button | Task 8 |
| How It Works: 6 steps verbatim | Task 9 |
| About: values, guarantee, testimonials | Task 10 |
| Make a Payment stub | Task 11 |
| 404 page | Task 11 |
| robots.txt | Task 11 |
| sitemap.xml via plugin | Task 1 (.eleventy.js) |
| Unsplash placeholders committed | Task 4 |
| Sample data: 3 properties, lat/lng, all fields | Task 2 |
| Data validation tests | Task 2 |
| Build output tests (listing pages, buy button rule) | Task 8 |
| Lighthouse > 90 verified | Task 12 |
| Mobile 390px verified | Tasks 12, 13 |
| No JS except map and filter | All templates |
| No em dashes in any copy | All templates |
