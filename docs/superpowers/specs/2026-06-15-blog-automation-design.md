# Blog automation design

Owner: Tyler Quackenbush
Status: Approved for implementation
Date: 2026-06-15

---

## What we are building

A buyer-education blog at `landtolandholdings.com/blog/` that runs mostly on autopilot. Every Monday a GitHub Action scrapes Reddit for land buying questions, picks the highest-scoring uncovered one, calls Claude API to write a post in Tyler's voice, pulls a matching photo from Unsplash, and opens a GitHub PR. Tyler or his VA reviews the draft, edits if needed, and merges. Merge triggers Cloudflare Pages and the post is live within 60 seconds.

The blog is SEO-driven content that answers real questions buyers are already asking. Every post ends with a CTA linking to active listings.

---

## Goals

1. Publish one buyer-education post per week with zero manual writing required.
2. Posts sound like Tyler wrote them, not like AI.
3. Nothing publishes without a human review.
4. Zero new tools, subscriptions, or infrastructure beyond an Anthropic API key.

---

## Non-goals

- Email newsletter (possible future addition, not in scope here)
- Comments or community features
- Author profiles or multiple contributors
- Pagination (not needed until 20+ posts)
- AI-generated images (Unsplash stock photos only)

---

## Architecture

The blog lives entirely inside the existing Eleventy site. No separate CMS or platform.

```
content/blog/                          ← one .md file per post
  2026-06-16-how-does-owner-financing-work-on-vacant-land.md
  2026-06-23-can-you-live-in-an-rv-on-vacant-land-you-own.md

assets/blog/{slug}/
  hero.jpg                             ← downloaded from Unsplash at generation time

data/blog-topics.json                  ← tracks covered questions, prevents repeats
data/blog-subreddits.json              ← list of subreddits to scrape

docs/blog-voice.md                     ← Tyler's voice guide, referenced by every post

.github/workflows/blog-generator.yml  ← the weekly automation
```

Eleventy builds:
- `/blog/` — listing page, card grid, newest first
- `/blog/{slug}/` — individual post page

---

## Post format

### Frontmatter

```yaml
---
title: How does owner financing work on vacant land?
date: 2026-06-16
slug: how-does-owner-financing-work-on-vacant-land
reddit_source: https://reddit.com/r/landinvesting/comments/...
tags: [owner-financing, buying-land]
excerpt: One-paragraph teaser shown on the listing page and in meta description.
image: /assets/blog/how-does-owner-financing-work-on-vacant-land/hero.jpg
image_credit: Unsplash
---
```

### Page layout

- Full-width hero image (Unsplash, downloaded and committed)
- Breadcrumb: Home › Blog › Post title
- H1 title
- Meta line: date, read time, photo credit
- Body copy (500-800 words, Tyler's voice)
- CTA block: links to `/properties/`, mentions active markets (FL, NM, OR)
- Unsplash attribution line (required by their free license)

---

## Automation pipeline

GitHub Action: `.github/workflows/blog-generator.yml`
Schedule: every Monday at 6am ET (`0 10 * * 1` UTC in summer / `0 11 * * 1` in winter — adjust for daylight saving)
Also triggerable manually via `workflow_dispatch`.

### Steps

1. Checkout repo
2. Scrape Reddit JSON API (no key required) for each subreddit in `data/blog-subreddits.json`
   - Target subreddits: `r/landinvesting`, `r/OffGrid`, `r/homesteading`, `r/vandwellers`
   - Pull top 50 posts from each, last 30 days
   - Filter to posts that are questions (title ends in `?` or contains question words)
   - Score each by: upvotes + (comment count × 2)
3. Load `data/blog-topics.json`, filter out already-covered questions
4. Pick the highest-scoring uncovered question
5. Fetch top 5 comments from that post (context for what readers actually want answered)
6. Load `docs/blog-voice.md`
7. Call Claude API (`claude-sonnet-4-6`) with:
   - Voice guide as system prompt
   - The question + top comments as user context
   - Instruction: write a 500-800 word post answering this as Tyler, land investor in GA
8. Extract 2-3 keywords from the question for Unsplash search
9. Call Unsplash API, download best-match photo to `assets/blog/{slug}/hero.jpg`
10. Write the markdown file to `content/blog/YYYY-MM-DD-{slug}.md`
11. Append the new topic to `data/blog-topics.json`
12. Create branch: `blog/YYYY-MM-DD-{slug}`
13. Commit all new/changed files
14. Open PR titled: `blog: {question}`
15. GitHub emails Tyler and VA the PR link

### Secrets required

| Secret | Purpose |
|--------|---------|
| `ANTHROPIC_API_KEY` | Claude API for post generation |
| `UNSPLASH_ACCESS_KEY` | Unsplash API for photo search |

Reddit scraping uses the public JSON API (`reddit.com/r/{sub}.json`) — no key needed.

### Fallback

If Reddit scraping fails or returns no new questions, the Action checks `data/blog-queue.json` for manually queued topics. If that's also empty, the Action exits cleanly with a warning — no partial commit, no broken post.

---

## Review flow

1. Action opens a PR: `blog/2026-06-16-how-does-owner-financing-work-on-vacant-land`
2. GitHub emails Tyler and VA with a link to the PR
3. Reviewer reads the draft in GitHub's PR view (browser, no coding required)
4. Reviewer can edit the markdown file directly in the PR if anything needs adjusting
5. Reviewer clicks "Merge pull request" to publish, or closes the PR to discard
6. Merge triggers Cloudflare Pages deploy — post is live within ~60 seconds

---

## Voice guide

Stored at `docs/blog-voice.md`. Tyler's full writing rules, banned word list, and anti-AI-pattern guide live here verbatim. The Claude API system prompt loads this file on every run. It is the single source of truth for post tone and style.

Hard rules enforced:
- No em dashes
- No banned vocabulary (delve, harness, pivotal, leverage, etc.)
- No negative parallelisms ("This isn't X. This is Y.")
- Short paragraphs, varied rhythm, direct address
- Take a stance, be specific, use real numbers

---

## Topic tracking

`data/blog-topics.json` is committed to the repo and updated by the Action each run.

```json
[
  {
    "question": "How does owner financing work on vacant land?",
    "slug": "how-does-owner-financing-work-on-vacant-land",
    "reddit_source": "https://reddit.com/r/landinvesting/comments/...",
    "published": "2026-06-16"
  }
]
```

The Action uses this to skip questions already covered. VA can also manually add entries to block a topic without publishing a post.

---

## Subreddit list

`data/blog-subreddits.json` — editable without touching the Action code.

```json
["landinvesting", "OffGrid", "homesteading", "vandwellers"]
```

---

## Blog listing page (`/blog/`)

- Card grid (2 columns desktop, 1 column mobile)
- Each card: hero image, date, title, one-sentence excerpt, "Read more →" link
- Page header: hand-written once ("Land buying questions, answered plainly.")
- No pagination until 20+ posts
- Newest first

---

## Constraints inherited from PRD

- No JavaScript required for blog content (Eleventy renders static HTML)
- Mobile-first (same as listings)
- No em dashes in any copy, generated or hand-written
- Photos downloaded and committed — no hotlinking external URLs
- Airtable is NOT involved in the blog system (read-only PAT rule preserved)

---

## Acceptance criteria

- [ ] `/blog/` listing page renders on mobile with correct card layout
- [ ] `/blog/{slug}/` individual post renders with hero image, body, CTA block
- [ ] GitHub Action runs on Monday 6am ET schedule and via manual dispatch
- [ ] Action creates a PR with correct branch name and title format
- [ ] Post body passes voice guide: no banned words, no em dashes, no negative parallelisms
- [ ] Unsplash image downloaded and committed, not hotlinked
- [ ] `data/blog-topics.json` updated on each run so no topic repeats
- [ ] If Reddit scrape fails, Action exits cleanly without partial commit
- [ ] Lighthouse performance score on blog pages > 90 (matches PRD requirement)
