# Phase 1 Static Shell — Design Spec

Owner: Tyler Quackenbush
Date: 2026-06-10
Status: Approved
Phase: 1 of 4

## What Phase 1 delivers

A fully deployed static shell: all six pages plus a listing detail template, populated with hardcoded sample data, live on a Cloudflare Pages preview URL. No Airtable sync. No real property data. Acceptance criteria: all pages render correctly on mobile, Lighthouse performance score above 90.

## Stack and infrastructure

- **Generator:** Eleventy 3.x. Plain HTML/CSS/JS output, no client framework.
- **Repo:** New GitHub repo, name `land-to-land-website`, private. Branch `main` is the deployment branch.
- **Hosting:** Cloudflare Pages connected to the GitHub repo via git integration. Push to `main` deploys automatically. Phase 1 targets the CF Pages preview URL; production DNS cutover is Phase 3.
- **npm scripts:**
  - `dev` — Eleventy dev server with live reload
  - `build` — generates `_site/` from templates and data
  - `sync` — stub only in Phase 1; implemented in Phase 2
  - `test` — stub only in Phase 1; implemented in Phase 2

## Project structure

```
/
├── src/
│   ├── _includes/
│   │   ├── base.njk              ← global layout (nav, footer, script stubs)
│   │   └── partials/             ← reusable blocks (hero, card, trust-bar, etc.)
│   ├── _data/
│   │   └── properties.json       ← hardcoded sample data (Phase 1)
│   ├── index.njk                 ← Home
│   ├── properties.njk            ← Property Map
│   ├── property/
│   │   └── property.njk          ← Listing detail template (Eleventy pagination, one page per record)
│   ├── how-it-works.njk
│   ├── about.njk
│   ├── make-a-payment.njk
│   └── 404.html
├── assets/
│   ├── css/
│   │   └── styles.css            ← single stylesheet, CSS custom properties
│   ├── js/
│   │   └── map.js                ← Leaflet init, reads window.PROPERTIES
│   └── properties/               ← committed photos (Phase 2); Unsplash placeholders in Phase 1
├── scripts/
│   └── sync.mjs                  ← Phase 2 stub
├── .eleventy.js
├── package.json
└── .gitignore
```

## Design direction

**Direction A — Navy Dominant.** Full-width photo hero with a dark navy gradient overlay. White content sections below. Lime green reserved for CTA buttons and eyebrow labels on dark navy surfaces only. Inter throughout.

### Color tokens

```css
--color-navy:           #1F4C6B;   /* primary brand, navs, headings on white */
--color-navy-dark:      #163650;   /* nav bar, trust bar, dark surfaces */
--color-navy-body:      #1A3347;   /* body text on white — 11.6:1 AAA */
--color-navy-muted:     #2E5068;   /* secondary text on white — 7.1:1 AAA */
--color-lime:           #8BC83F;   /* CTA buttons, eyebrows/values on dark navy only */
--color-lime-text:      #0D2600;   /* text ON lime buttons — 8.9:1 AAA */
--color-lime-tint:      rgba(139,200,63,0.12); /* badge backgrounds on white */
--color-lime-tint-text: #4A7A1A;   /* text in lime-tint badges — 4.6:1 AA */
--color-white:          #FFFFFF;
--color-off-white:      #F2F6F9;   /* card section backgrounds */
--color-border:         rgba(31,76,107,0.10);
```

### WCAG AAA contrast rules

| Pairing | Ratio | Level | Where used |
|---|---|---|---|
| White on hero overlay | 11.4:1 | AAA | Headlines and body over photo |
| #8BC83F on dark navy | 7.8:1 | AAA | Eyebrow labels, trust bar values |
| #0D2600 on #8BC83F | 8.9:1 | AAA | CTA button text |
| #1A3347 on white | 11.6:1 | AAA | Body text in white sections |
| #2E5068 on white | 7.1:1 | AAA | Secondary/muted text |
| #8BC83F on white | 2.1:1 | FAIL | **Never used — lime is never text on light backgrounds** |

### Typography

Font family: Inter (all weights via Google Fonts).

| Role | Size | Weight | Letter-spacing | Line-height |
|---|---|---|---|---|
| Display / hero headline | clamp(32px, 9vw, 48px) | 900 | -1.5px | 0.95 |
| Section heading | clamp(20px, 5vw, 28px) | 800 | -0.8px | 1.1 |
| Card title / price | 15px | 800 | -0.3px | — |
| Body | 14px | 400 | — | 1.6 |
| Eyebrow / label | 10px | 700 | 2px | — (uppercase) |
| Secondary / caption | 12px | 500 | — | — |

### Spacing scale

4 / 8 / 12 / 16 / 24 / 32 / 48 / 64px

### Breakpoints

Mobile-first. Single column up to 640px. Two-column cards at 640px. Full desktop layout at 1024px.

### Border radius

5px buttons, 8px cards, 12px modals/overlays.

## Global layout shell

`src/_includes/base.njk` provides:

- **Nav:** Dark navy (`--color-navy-dark`) background. White logo text. Hamburger on mobile, full inline links on desktop. Phone number button (678-336-1879) in the nav.
- **Footer:** "Land to Land Holdings has helped hundreds of buyers secure their ideal properties." Three columns: Navigation, Information, Contact (2870 Peachtree Rd NW #915-8271, Atlanta GA 30305 / info@landtolandholdings.com / 678-336-1879). Facebook and Instagram icons. Terms and Conditions and Privacy Policy links. Copyright line with auto-updated year.
- **`<head>` stub:** `<!-- GHL TRACKING SCRIPT -->` comment — Tyler replaces before Phase 3.
- **Before `</body>` stub:** `<!-- GHL CHAT WIDGET -->` comment — Tyler replaces before Phase 3.

## Pages

### Home (`/`)

1. Full-width photo hero: eyebrow "Owner-Financed Vacant Land," headline "Your Perfect Piece of Land Starts Here," subtext "No banks, no credit checks. Work directly with Tyler.", lime CTA "Explore Properties."
2. Trust bar (dark navy): $0 Bank Required / No Credit Check / 30-Day Refund.
3. How It Works summary (4 steps, condensed from content-reference.md).
4. Commitments grid: Transparent Listings, Flexible Options, Price Match Guarantee, 30 Day Returns/Refund.
5. Customer Success Stories: 3 hardcoded stories (Tom, Erika, Kevin and Jesica from content-reference.md).
6. Closing CTA: "Your Land Is Waiting!" with "Find Property" button.

### Property Map (`/properties/`)

1. Leaflet satellite map (Esri World Imagery, no API key). Markers are lime green circles. Popup: price/mo + link to listing.
2. Filter bar: State, County, Available/Sold. Client-side, reads `window.PROPERTIES` injected by Eleventy.
3. Card grid below map: photo, title ("X acre property in {County}, {State} for ${monthly}/mo"), Property ID, acreage, price, View Details button.

### Listing Detail (`/property/{slug}/`)

Slug pattern: `{acreage}-acre-{city}-{county}-{state}-{property-id}`, lowercase kebab.

Section order (from content-reference.md):
1. Photo strip: horizontally scrollable row on mobile, 2-column grid on desktop. No JS required — CSS scroll-snap only.
2. Pricing block: "${monthly}/mo" headline, "${down} down + ${doc_fee} doc fee" subline
3. Buy Now button (lime, links to `geekpay_url`; hidden if `geekpay_url` is null or empty)
4. Ask a Question button (links to GHL form stub)
5. Description
6. Location (Property ID, Street Address, City, State, County, GPS, Google Maps link)
7. Property Specifics (APN, Subdivision, Short Legal)
8. Property Characteristics (Acreage, Elevation, Terrain, Lot Dimensions)
9. Building Information (Q&A fields with Planning and Zoning disclaimer verbatim)
10. Allowable Uses
11. Utilities (Water, Sewer/Septic, Electricity, Gas)

Under Contract status: badge displayed, Buy Now button hidden.

### How It Works (`/how-it-works/`)

Port of current site copy verbatim from content-reference.md. Hero section, intro paragraph, 6-step layout with icons. GHL form embed stub at bottom.

### About Us (`/about/`)

Tyler intro with YouTube video embed placeholder (iframe, Tyler supplies URL before Phase 3). Why Land section. Values section (4 cards). Guarantee section. Testimonials carousel (3 hardcoded from content-reference.md).

### Make a Payment (`/make-a-payment/`)

Minimal page. GeekPay buyer portal link stub (Tyler supplies URL before Phase 3). GHL contact button. No other content.

### Extras

- `404.html` — branded, links to Home and Property Map.
- `sitemap.xml` — generated by `@quasibit/eleventy-plugin-sitemap`; includes all published pages.
- `robots.txt` — allow all, point to sitemap.

## Sample data (Phase 1 hardcoded)

Three properties covering all three active markets and two status types:

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
    "monthly": 199,
    "down": 299,
    "doc_fee": 299,
    "cash_price": 7500,
    "geekpay_url": "#",
    "description": "Five acres of peaceful Florida countryside in Putnam County."
  },
  {
    "id": "LTL-002",
    "slug": "10-acre-deming-luna-nm-ltl-002",
    "status": "Under Contract",
    "acreage": 10,
    "city": "Deming",
    "county": "Luna",
    "state": "NM",
    "monthly": 149,
    "down": 199,
    "doc_fee": 299,
    "cash_price": 5500,
    "geekpay_url": null,
    "description": "Ten acres of high desert in Luna County, New Mexico."
  },
  {
    "id": "LTL-003",
    "slug": "2-acre-klamath-falls-klamath-or-ltl-003",
    "status": "Active",
    "acreage": 2,
    "city": "Klamath Falls",
    "county": "Klamath",
    "state": "OR",
    "monthly": 249,
    "down": 399,
    "doc_fee": 299,
    "cash_price": 9500,
    "geekpay_url": "#",
    "description": "Two acres in Klamath County, Oregon with mountain views."
  }
]
```

LTL-002 validates two rules: Under Contract badge renders, and null `geekpay_url` hides the Buy Now button.

Photos: Unsplash placeholder images committed to `assets/properties/{id}/` for Phase 1. Replaced with real downloaded photos in Phase 2.

## Logo

Source file: `/Users/tyler/Library/Mobile Documents/com~apple~CloudDocs/Land to Land Holdings/Logos/Land to Land Logo Horizontal 1.svg`

Copy to `assets/images/logo.svg` at project setup. The SVG is black; apply `filter: brightness(0) invert(1)` in CSS to render it white on the dark nav bar. No separate white export needed.

## Acceptance criteria (Phase 1)

- All six pages plus the listing detail template render without errors.
- All pages are functional on a 390px mobile viewport.
- Lighthouse performance score above 90 on mobile (Chrome DevTools).
- No JavaScript required for any page except the Leaflet map and the client-side property filter.
- The CF Pages preview URL is live and accessible.
- Under Contract badge renders on LTL-002 and its Buy Now button is absent.
- No buy button appears on any listing with a null or empty `geekpay_url`.

## What Phase 1 does NOT include

- Airtable sync (Phase 2)
- Real property photos (Phase 2)
- GHL form embed codes, chat widget, or tracking script (Tyler supplies; stubbed with comments)
- GeekPay buyer portal link on Make a Payment (Tyler supplies before Phase 3)
- Tyler's YouTube video URL on About (Tyler supplies before Phase 3)
- Production DNS / domain cutover (Phase 3)
- 301 redirects from Acrefy URL patterns (Phase 3)
