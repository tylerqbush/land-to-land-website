# PRD: Land to Land Holdings Static Site + Airtable Sync

Owner: Tyler Quackenbush
Status: Approved for MVP build
Last updated: 2026-06-10

## 1. What we are building

A static website that replaces the current Acrefy-hosted site at landtolandholdings.com. Pages are generated from the Airtable "Ground Control" base. A scheduled sync job regenerates listing pages when Airtable changes, commits to the repo, and Cloudflare Pages deploys automatically. GoHighLevel keeps handling forms, CRM, calendar, and tracking via embeds. GeekPay handles checkout via per-property links.

Goals, in order:
1. Replace Acrefy (kill the subscription) with zero loss of buyer-facing function.
2. Listings publish and update automatically from Ground Control with no manual web work.
3. Fast cutover. MVP first, polish later.

Non-goals for MVP: AI-generated listing copy (use the Web Description field as-is), blog, buyer accounts, payment processing on-site (GeekPay links only), A/B testing.

## 2. Architecture

- Static site generator: Eleventy (11ty) or Astro, builder's choice. Plain HTML/CSS/JS output. No client framework required.
- Hosting: Cloudflare Pages, free tier, custom domain landtolandholdings.com.
- Repo: GitHub. Cloudflare Pages connected via git integration (push to main = deploy).
- Sync: GitHub Actions workflow on cron (every 30 min) plus manual dispatch. Pulls Airtable records, writes/updates a `data/properties.json` snapshot and downloads photos, regenerates pages, commits only if content changed.
- Secrets: `AIRTABLE_PAT` as a GitHub Actions secret. Personal access token scoped READ-ONLY to the Ground Control base only. The site build must never have write access to Airtable.
- Maps: Leaflet with free Esri World Imagery satellite tiles. No Google Maps API key for MVP. Marker popups show price/mo and link to the listing (matches current site behavior Tyler wants to keep).

## 3. Data contract (Airtable)

- Base: Ground Control, ID `appE5El6Tgi6LS2Z6`
- Table: Properties, ID `tblIXORnaELK4K4w8`
- NEVER touch the "Ground Control Archive" base. Read-only access to everything.
- Resolve field names to field IDs at sync time via the Airtable Meta API (schema endpoint) so renames fail loudly instead of silently. Known confirmed IDs: Status = `fldGyOzIt4qLKmDzZ`, GeekPay Checkout URL = `fldC434guBKgVwO76`, Down Payment = `fldXADhg3U4jDx7Ap`.

Key fields by name (full list comes from the schema pull; these drive the templates):
- Identity/location: Property ID, APN, County, State, City, Street Address, GPS Coordinates, Subdivision, Short Legal, Nearby City and Attractions
- Characteristics: Acreage, Elevation, Terrain, Lot Dimensions, Zoning Designation, Annual Taxes
- Building info Q&A: Time Limit to Build, Single Family Homes Allowed, Modular Homes Allowed, Manufactured Homes Allowed, Tiny Home Friendly, Septic System Required to Build, Flood Plain
- Allowable uses: Full-Time RV Living, RV While You Build, Camping in RV, Tent Camping, Hunting
- Utilities: Well, Septic, Electricity, Solar, Propane, Gas
- Pricing (simplified model, no tiers): "Easy Financing - per month" (monthly price), "Down Payment" (new field), "Processing Fee" (displayed as document fee), Cash Purchase Price (optional secondary line)
- Commerce: GeekPay Checkout URL. If empty, render NO buy button; show Ask a Question only.
- Content: Web Description, Photos (attachments), Custom Photo Links, Featured Video, Embedded Map URL, Google Maps Link
- SEO: SEO Title, SEO Meta Description, SEO Keywords (formula fields, use verbatim)

### Publish rules (Status single select)
- `Active` = published, buyable
- `Under Contract ` (note trailing space in option name) = published with Under Contract badge, buy button disabled
- `Sold` = published in Sold state (shown when map/list filter = Sold), no buy button
- `Intake`, `Due Diligence `, `Acquisition Closing `, `Draft`, `Declined/Inactive` = never published; if a previously published record moves to one of these, its page is removed on next sync

### Photo handling (important)
Airtable attachment URLs EXPIRE within hours. The sync job must download attachments at sync time into `assets/properties/{property-id}/`, generate resized variants (thumb ~480px, card ~960px, full ~1600px, webp), and commit them. Templates reference local paths only. Never hotlink Airtable URLs.

### Change detection
Compute a content hash per record (relevant fields + attachment IDs). Store hashes in `data/hashes.json` in the repo. Skip regeneration when hash unchanged so commits stay minimal and diffs reviewable.

## 4. Site map and pages

Replicates the current 5-page structure. Screenshots of the current site are in `docs/reference/` for content extraction.

1. `/` Home: hero, category teasers, How It Works summary, Commitments (Transparent Listings, Flexible Options, Price Match Guarantee, 30 Day Returns/Refund), Customer Success Stories, CTA. Copy ported from current site.
2. `/properties/` Property Map: Leaflet satellite map with price markers + filter bar (State, County, City, Price range, Available/Sold) + card grid. Cards: photo, title pattern "X acre property in {County}, {State} for ${monthly}/mo (APN {apn})", Property ID, acreage, price, View Details. All filtering client-side against `properties.json`.
3. `/property/{slug}/` Listing detail: design per chosen mockup direction (see docs/design/). Slug pattern: `{acreage}-acre-{city}-{county}-{state}-{property-id}` lowercased/kebab. Pricing display: "${monthly}/mo" headline, "${down} down + ${docfee} doc fee" subline, Buy Now button → GeekPay Checkout URL (new tab), Ask a Question button → GHL form. Include the planning/zoning disclaimer block (copy in docs/reference/).
4. `/how-it-works/` Port current copy and 6-step layout.
5. `/about/` Port current copy, video embed, core values, guarantee, testimonials.
6. `/make-a-payment/` Links to GeekPay buyer portal + GHL contact (Tyler supplies links).
7. `404.html`, `/sitemap.xml`, `robots.txt`, per-page meta from SEO fields, OpenGraph image per listing (first photo).

GHL embeds: contact/Ask a Question form embed code and chat widget script (Tyler supplies). GHL tracking script in base layout so ad traffic attribution keeps working.

## 5. Design

Three approved mockups exist in `docs/design/`: direction-a-open-range.html, direction-b-basecamp.html, direction-c-plat-book.html. Tyler selects one (possibly with elements from others) before the template build. The frontend-design plugin should treat the chosen file as the design reference: palette, type, spacing, components. Brand: existing Land to Land logo (black), buyer audience skews rural/practical, mobile-first (most traffic is Meta ads on phones). No em dashes anywhere in site copy.

## 6. Phases and acceptance criteria

Phase 1, static shell: 5 pages + listing template with hardcoded sample data deployed to Cloudflare Pages preview URL. Accept: all pages render on mobile, Lighthouse perf > 90.
Phase 2, sync: GitHub Action pulls Ground Control, generates all Active/Under Contract/Sold listings + properties.json + photos. Accept: changing a record's price in Airtable updates the live page within 35 min with no human action; moving Status to Draft removes the page; record with empty GeekPay URL shows no buy button.
Phase 3, cutover: DNS to Cloudflare Pages, 301 redirects from old Acrefy URL patterns, verify GHL forms/tracking fire, cancel Acrefy.
Phase 4, later: per-county AI copy via Claude API, PR-gated publishing, OG image generation, structured data (schema.org RealEstateListing).

## 7. Open items Tyler supplies during build

- Chosen design direction
- Logo file (SVG or high-res PNG)
- GHL form embed code + chat widget script + tracking script
- GeekPay buyer portal link for Make a Payment page
- Airtable PAT (read-only, Ground Control only) added as GitHub secret
- Down Payment + GeekPay Checkout URL values populated per Active record
