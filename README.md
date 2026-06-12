# Land to Land Holdings — Website

Static site for [landtolandholdings.com](https://landtolandholdings.com), built with Eleventy and deployed on Cloudflare Pages.

## Live preview

https://land-to-land-website.pages.dev

The hash-prefixed URLs (e.g. `https://8bc4d3ac.land-to-land-website.pages.dev`) are immutable per-deploy snapshots. The root subdomain always points to the latest deploy.

## Development

```bash
npm install
npm run dev      # local dev server at localhost:8080
npm run build    # production build to _site/
npm run sync     # pull Airtable data + photos, rebuild (Phase 2)
npm test         # run data and build tests
```

## Deploy (manual)

```bash
npm run build
npx wrangler pages deploy _site --project-name land-to-land-website
```

Wrangler will prompt for login on first run. After that it uses cached credentials.

## Repo structure

```
src/             Eleventy templates and pages
src/_data/       properties.json (hardcoded Phase 1, Airtable-synced Phase 2)
src/_includes/   layouts and partials
  base.njk       global HTML shell (fonts, CSS, GHL script stubs)
  partials/
    nav.njk      sticky top nav
    footer.njk   GHL forms section + site footer (social, CTA)
assets/
  css/styles.css single stylesheet, design tokens at top
  js/            filter JS for browse page
  images/        logo SVG
  properties/    placeholder property photos (LTL-001, LTL-002, LTL-003)
scripts/         Airtable sync script lives here in Phase 2
tests/           21 node:test unit tests (data shape + build output)
docs/            PRD and design specs
_site/           build output (gitignored)
```

## Pages

| Route | File | Notes |
|---|---|---|
| `/` | `src/index.njk` | Home — hero, find a parcel, commitments, featured properties, testimonials |
| `/properties/` | `src/properties.njk` | Browse — filter bar, card grid |
| `/property/{slug}/` | `src/property/property.njk` | Listing detail — paginated from properties data |
| `/how-it-works/` | `src/how-it-works.njk` | 6-step process page |
| `/about/` | `src/about.njk` | About, values, guarantee, testimonials |
| `/make-a-payment/` | `src/make-a-payment.njk` | GeekPay portal link (stub) |
| `/404.html` | `src/404.html` | Custom 404 |

## GHL integrations

| Integration | ID / URL | Where used |
|---|---|---|
| Booking calendar | `NZxhdH02tv2KlHXB3vTs` | Footer (all pages), hero CTA, How It Works CTA |
| Inquiry form | `https://link.acrematic.com/widget/form/EFb3P0mmN9Xshga1dEwo` | Footer (all pages) |
| Tracking script | stub comment | `base.njk` line 13 — replace with actual GHL snippet |
| Chat widget | stub comment | `base.njk` line 19 — replace with actual GHL snippet |

Booking embed URL: `https://link.acrematic.com/widget/booking/NZxhdH02tv2KlHXB3vTs`

Form auto-resize script is loaded from `https://link.acrematic.com/js/form_embed.js` — this is what prevents the form iframe from having internal scroll bars.

## Known stubs (replace before launch)

- **GeekPay buyer portal** — `src/make-a-payment.njk` line 15: `href="#"` needs the real URL
- **Social media links** — `src/_includes/partials/footer.njk`: Facebook, Instagram, YouTube all link to `#`
- **Property videos** — each listing detail page has a video placeholder; add a `video_url` field per property in Phase 2
- **GHL tracking + chat** — stub comments in `base.njk`; paste in the snippets from GHL settings

## Data — properties.json

Each property record has these fields. Fields marked `(Phase 2)` will come from Airtable in the sync.

```
id, name, slug, status, acreage, city, county, state, road_access
lat, lng, gps, google_maps_url
monthly, down, doc_fee, cash_price, annual_taxes
geekpay_url           null = no buy button shown
description
apn, address, zoning, acreage_display, elevation, terrain, lot_dimensions
time_limit_to_build, single_family_allowed, modular_allowed, manufactured_allowed
tiny_home_friendly, septic_required, flood_plain
full_time_rv, rv_while_build, camping_rv, tent_camping, hunting
well, septic, electricity, solar, propane, gas
subdivision, short_legal   (optional)
seo_title, seo_description, seo_keywords
photos                array of local asset paths
```

**Airtable note:** Status values in Airtable have trailing spaces ("Under Contract ", "Due Diligence "). The template uses `| trim` on status comparisons to handle this.

**road_access field:** Add a "Road Access" single-line text column (Yes/No) to Ground Control before Phase 2 sync.

**Name field:** The `name` field is new — it does not exist in Airtable yet. Add a "Website Name" single-line text column to Ground Control before running the Phase 2 sync, then map it in `scripts/sync.mjs`.

## Phase 1 — complete

- 7 pages (home, browse, listing detail x3, how it works, about, make a payment, 404)
- 21 passing tests
- Lighthouse: Performance 97, Accessibility 93, Best Practices 100, SEO 100
- Cloudflare Pages deployment working
- GHL inquiry form + booking calendar embedded in footer on all pages
- Google Maps iframe on each listing detail page
- Property detail layout: hero, photo grid, lifestyle icons, rules checklist, financing block, detail tables, location map

## Phase 2 — what comes next

1. **Airtable sync script** (`scripts/sync.mjs`) — reads Ground Control base `appE5El6Tgi6LS2Z6`, writes `src/_data/properties.json`, downloads photos to `assets/properties/{id}/`
2. **Content hashing** — `data/hashes.json` tracks which records changed so the sync only rebuilds what's new
3. **Real photos** — replace the 3 placeholder landscape photos with actual property photos from Airtable attachments
4. **Add "Website Name" column** to Ground Control Airtable base (maps to `name` field)
5. **Add "Video URL" column** to Ground Control for per-property YouTube/GHL video embeds
6. **Filter dropdowns** on browse page — currently hardcoded to FL/NM/OR; Phase 2 should derive options from live data
7. **Sitemap** — listing detail URLs are currently missing from sitemap.xml due to a pagination/plugin workaround; fix in Phase 2
8. **Production domain** — point landtolandholdings.com to Cloudflare Pages, add custom domain in CF dashboard
9. **GeekPay buyer portal URL** — update `make-a-payment.njk` with real URL
10. **Social media URLs** — update footer social icon links
