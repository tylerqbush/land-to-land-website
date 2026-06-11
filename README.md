# Land to Land Holdings — Website

Static site for [landtolandholdings.com](https://landtolandholdings.com), built with Eleventy and deployed on Cloudflare Pages.

## Preview URL

https://land-to-land-website.pages.dev

## Development

```bash
npm install
npm run dev      # local dev server at localhost:8080
npm run build    # production build to _site/
npm run sync     # pull Airtable data + photos, rebuild (Phase 2)
npm test         # run data and build tests
```

## Deploy

```bash
npm run build
npx wrangler pages deploy _site --project-name land-to-land-website
```

## Structure

```
src/             Eleventy templates and pages
src/_data/       properties.json (hardcoded Phase 1, Airtable-synced Phase 2)
src/_includes/   layouts and partials
assets/          CSS, JS, property photos
scripts/         sync script (Phase 2)
tests/           node:test data and build tests
docs/            PRD, design specs, plans
_site/           build output (gitignored)
```

## Phase 1 status

Six pages + listing detail template with 3 sample properties. All tests passing. Lighthouse: Performance 97, Accessibility 93, Best Practices 100, SEO 100.

Phase 2: Airtable sync, real property photos, production domain.
