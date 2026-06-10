# CLAUDE.md - Land to Land Website

Project: static site replacing Acrefy, generated from Airtable Ground Control, deployed on Cloudflare Pages.
Read docs/PRD.md before doing anything. It is the source of truth for scope.

## The six questions, answered

1. What does this agent do? Generates and updates the public website from Ground Control records on a schedule.
2. What does it never do? Write to Airtable. Touch the Ground Control Archive base. Publish records whose Status is not Active, Under Contract, or Sold. Invent property facts not present in the record.
3. What state does it keep? data/hashes.json (content hashes per record) and the committed site itself. The repo is the state.
4. How does it fail? Loudly. Any sync error fails the Action run and must not commit a partial build. A failed run leaves the live site untouched.
5. How do we trust it? Phase 2 runs on a preview branch with PR review until Tyler promotes it to direct-to-main. Git history is the audit trail and rollback.
6. Who owns it? Tyler. Temi never edits this repo.

## Hard rules

- Airtable access is READ-ONLY. The PAT must have read scope on base appE5El6Tgi6LS2Z6 only. Never request or use write scopes.
- Never hotlink Airtable attachment URLs. They expire. Download and commit.
- Empty GeekPay Checkout URL = no buy button on that listing. No exceptions, no placeholder links.
- Status option names contain trailing spaces in Airtable ("Under Contract ", "Due Diligence ", "Acquisition Closing "). Match exactly or normalize with trim, but be deliberate about it.
- No em dashes in any site copy, generated or hand-written. Use commas, periods, or parentheses.
- Plain direct copy voice. No corporate filler. Lead with the answer.
- Site must work without JavaScript except the map and filters. Listing content is server-rendered static HTML.
- Mobile-first. Most traffic is Meta ads opened on phones.
- Never mention animals, wildlife, fishing, or hunting in ad-facing marketing copy EXCEPT factual allowable-use data from Airtable fields (e.g. the Hunting allowed row in property details is fine; "great fishing nearby" prose is not).

## Conventions

- Generator: keep it boring. Eleventy or Astro, npm scripts: `dev`, `build`, `sync` (pull Airtable + photos + regenerate data), `test`.
- Sync script lives in scripts/sync.mjs. Pure Node, no framework coupling.
- Templates read ONLY from data/properties.json, never call Airtable at build time. Sync and build are separate steps.
- Slugs: {acreage}-acre-{city}-{county}-{state}-{property-id}, kebab-case. Property ID makes them unique and stable. Never change a published slug; if inputs change, keep the old slug via redirect.
- Commits from the Action: "sync: {n} updated, {m} added, {k} removed" with the property IDs in the body.
- Photos: assets/properties/{property-id}/{index}-{variant}.webp plus jpg fallback.
- Design tokens from the chosen mockup in docs/design/ are canonical. Do not invent new colors or fonts.

## Workflow

- Use the Superpowers plugin flow: brainstorm against the PRD to surface gaps, write the plan, execute with tests on the sync script (hash logic, publish rules, slug generation, photo pipeline all get unit tests).
- Use the frontend design plugin when building templates, with the chosen mockup file as the reference.
- One phase per plan. Do not start Phase 2 work during Phase 1.
- When uncertain about a product decision not covered in the PRD, stop and ask Tyler. Do not guess on anything buyer-facing.
