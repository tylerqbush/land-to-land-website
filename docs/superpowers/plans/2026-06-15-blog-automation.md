# Blog automation implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a buyer-education blog at `/blog/` with a weekly GitHub Action that scrapes Reddit, generates posts via Claude API in Tyler's voice, downloads a matching Unsplash photo, and opens a PR for human review before publish.

**Architecture:** Markdown post files live in `src/blog/posts/` and are built by Eleventy into `/blog/{slug}/`. A Node.js script (`scripts/blog-generator.mjs`) handles scraping, generation, and photo download. A GitHub Action runs the script every Monday at 6am ET, commits the output to a branch, and opens a PR.

**Tech stack:** Eleventy v3 (existing), Node.js built-in test runner (existing), `@anthropic-ai/sdk`, Reddit public JSON API (no key), Unsplash API (free key), GitHub Actions with `gh` CLI for PR creation.

---

## File map

| File | Status | Purpose |
|------|--------|---------|
| `eleventy.config.mjs` | Modify | Add `"md"` to templateFormats, add `blogPosts` collection, add `readingTime` filter |
| `package.json` | Modify | Add `@anthropic-ai/sdk` dependency, add `blog:generate` script, add blog test to test command |
| `src/blog/index.njk` | Create | Blog listing page at `/blog/` |
| `src/blog/posts/posts.11tydata.js` | Create | Directory data: layout, tag, computed permalink |
| `src/blog/posts/.gitkeep` | Create | Keeps empty dir in git |
| `src/_includes/blog-post.njk` | Create | Individual post layout |
| `src/_includes/partials/blog-card.njk` | Create | Card used on listing page |
| `assets/css/styles.css` | Modify | Blog card + post page styles |
| `data/blog-topics.json` | Create | Covered topics tracker (initially `[]`) |
| `data/blog-subreddits.json` | Create | Subreddit list the generator scrapes |
| `docs/blog-voice.md` | Create | Tyler's voice guide (loaded by generator at runtime) |
| `scripts/lib/reddit.mjs` | Create | Reddit scraping and scoring functions |
| `scripts/lib/claude.mjs` | Create | Claude API post generation + keyword extraction |
| `scripts/lib/unsplash.mjs` | Create | Unsplash search + image download |
| `scripts/blog-generator.mjs` | Create | Main orchestration script |
| `tests/blog-generator.test.mjs` | Create | Unit tests for all pure functions |
| `.github/workflows/blog-generator.yml` | Create | Weekly Action: run script, commit, open PR |

---

## Task 1: Eleventy markdown support + blog collection

**Files:**
- Modify: `eleventy.config.mjs`
- Create: `src/blog/posts/.gitkeep`
- Create: `src/blog/posts/posts.11tydata.js`

- [ ] **Step 1: Add `.gitkeep` so empty posts dir is committed**

```bash
mkdir -p src/blog/posts
touch src/blog/posts/.gitkeep
```

- [ ] **Step 2: Create directory data file for posts**

Create `src/blog/posts/posts.11tydata.js`:

```js
export default {
  layout: "blog-post.njk",
  tags: ["blogPost"],
  eleventyComputed: {
    permalink: (data) => `/blog/${data.slug}/index.html`,
  },
};
```

- [ ] **Step 3: Add markdown support, blog collection, and readingTime filter to Eleventy config**

In `eleventy.config.mjs`, make these three changes:

Change `templateFormats`:
```js
// from:
templateFormats: ["njk", "html"],
// to:
templateFormats: ["njk", "html", "md"],
```

Add the collection (after the existing `sitemapPages` collection):
```js
eleventyConfig.addCollection("blogPosts", (collectionApi) => {
  return collectionApi
    .getFilteredByTag("blogPost")
    .sort((a, b) => b.date - a.date);
});
```

Add the filter (after the existing `json` filter):
```js
eleventyConfig.addFilter("readingTime", (content) => {
  const words = content ? content.trim().split(/\s+/).length : 0;
  return Math.max(1, Math.round(words / 200));
});
```

- [ ] **Step 4: Verify build still passes with no posts**

```bash
npm run build
```

Expected: build completes with no errors. `_site/` directory present.

- [ ] **Step 5: Commit**

```bash
git add eleventy.config.mjs src/blog/posts/
git commit -m "feat: add Eleventy markdown support and blogPosts collection"
```

---

## Task 2: Blog post layout template

**Files:**
- Create: `src/_includes/blog-post.njk`

- [ ] **Step 1: Create the layout**

Create `src/_includes/blog-post.njk`:

```njk
---
layout: base.njk
---
{%- set pageTitle = title + " | Land to Land Holdings" -%}
{%- set description = excerpt -%}

<article class="blog-post">

  {# Hero image #}
  {% if image %}
  <div class="blog-post__hero">
    <img
      src="{{ image }}"
      alt="{{ title }}"
      class="blog-post__hero-img"
      fetchpriority="high"
      width="1200"
      height="630"
    >
  </div>
  {% endif %}

  <div class="container">
    <div class="blog-post__inner">

      {# Breadcrumb #}
      <nav class="blog-post__breadcrumb" aria-label="Breadcrumb">
        <a href="/">Home</a>
        <span aria-hidden="true">&rsaquo;</span>
        <a href="/blog/">Blog</a>
        <span aria-hidden="true">&rsaquo;</span>
        <span>{{ title }}</span>
      </nav>

      {# Title #}
      <h1 class="blog-post__title">{{ title }}</h1>

      {# Meta #}
      <p class="blog-post__meta">
        {{ date | date("MMMM d, yyyy") }}
        &middot;
        {{ content | readingTime }} min read
      </p>

      {# Body #}
      <div class="blog-post__body">
        {{ content | safe }}
      </div>

      {# CTA #}
      <div class="blog-post__cta">
        <p class="blog-post__cta-heading">Looking for land with owner financing?</p>
        <p class="blog-post__cta-sub">We carry properties in Florida, New Mexico, and Oregon with simple terms and no credit check.</p>
        <a href="/properties/" class="btn btn-primary">Browse available land &rarr;</a>
      </div>

      {# Unsplash attribution (required by license) #}
      {% if image_credit_name %}
      <p class="blog-post__photo-credit">
        Photo by <a href="{{ image_credit_url }}" target="_blank" rel="noopener noreferrer">{{ image_credit_name }}</a> on <a href="https://unsplash.com" target="_blank" rel="noopener noreferrer">Unsplash</a>
      </p>
      {% endif %}

    </div>
  </div>
</article>
```

- [ ] **Step 2: Create a test post to verify the layout renders**

Create `src/blog/posts/2026-01-01-test-post.md` (temporary, will delete after test):

```markdown
---
title: "Test post for layout verification"
date: 2026-01-01
slug: test-post
excerpt: "This is a test post."
image: ""
image_credit_name: ""
image_credit_url: ""
---

This is the test post body. It has a few sentences to test reading time calculation. Owner financing makes land accessible to buyers who can't get a bank loan.
```

- [ ] **Step 3: Build and verify the post renders at the correct URL**

```bash
npm run build
```

Expected: `_site/blog/test-post/index.html` exists with the post content.

```bash
grep -l "Test post for layout" _site/blog/test-post/index.html
```

Expected: `_site/blog/test-post/index.html`

- [ ] **Step 4: Delete the test post and rebuild**

```bash
rm src/blog/posts/2026-01-01-test-post.md
npm run build
```

Expected: build succeeds, `_site/blog/test-post/` no longer exists.

- [ ] **Step 5: Commit**

```bash
git add src/_includes/blog-post.njk
git commit -m "feat: add blog post layout template"
```

---

## Task 3: Blog card partial + listing page

**Files:**
- Create: `src/_includes/partials/blog-card.njk`
- Create: `src/blog/index.njk`

- [ ] **Step 1: Create the blog card partial**

Create `src/_includes/partials/blog-card.njk`:

```njk
<a href="/blog/{{ post.data.slug }}/" class="blog-card">
  <div class="blog-card__photo">
    {% if post.data.image %}
      <img src="{{ post.data.image }}" alt="{{ post.data.title }}" loading="lazy" width="600" height="315">
    {% else %}
      <div class="blog-card__photo-placeholder"></div>
    {% endif %}
  </div>
  <div class="blog-card__body">
    <p class="blog-card__date">{{ post.date | date("MMMM d, yyyy") }}</p>
    <h2 class="blog-card__title">{{ post.data.title }}</h2>
    <p class="blog-card__excerpt">{{ post.data.excerpt }}</p>
    <span class="blog-card__link">Read more &rarr;</span>
  </div>
</a>
```

- [ ] **Step 2: Create the blog listing page**

Create `src/blog/index.njk`:

```njk
---
layout: base.njk
title: "Land Buying Questions, Answered | Land to Land Holdings"
description: "Real questions from land buyers, answered plainly. Owner financing, zoning, off-grid living, and more."
permalink: /blog/index.html
---

<section class="section">
  <div class="container">
    <p class="eyebrow mb-2" style="color:var(--color-terra);">Blog</p>
    <h1 class="heading-lg mb-3">Land buying questions, answered plainly.</h1>
    <p class="body-lg mb-10" style="max-width:600px;">We pull the most common questions people are asking about buying vacant land and answer them straight.</p>

    {% if collections.blogPosts.length == 0 %}
      <p style="color:var(--color-text-muted);">Posts coming soon.</p>
    {% else %}
      <div class="card-grid blog-grid">
        {% for post in collections.blogPosts %}
          {% set post = post %}
          {% include "partials/blog-card.njk" %}
        {% endfor %}
      </div>
    {% endif %}
  </div>
</section>
```

- [ ] **Step 3: Add a test post, build, and verify the listing page**

Create `src/blog/posts/2026-01-01-test-post.md`:

```markdown
---
title: "How does owner financing work on vacant land?"
date: 2026-01-01
slug: test-owner-financing
excerpt: "Banks don't like vacant land. Owner financing means the seller does what the bank won't."
image: ""
image_credit_name: ""
image_credit_url: ""
---

Banks don't like vacant land. Most won't touch it. So when someone says "owner financing," they mean the seller is doing what the bank won't.
```

```bash
npm run build
grep -l "owner financing" _site/blog/index.html
```

Expected: `_site/blog/index.html` — listing page shows the test card.

```bash
grep -l "owner financing" _site/blog/test-owner-financing/index.html
```

Expected: `_site/blog/test-owner-financing/index.html` — individual post renders.

- [ ] **Step 4: Delete test post and rebuild**

```bash
rm src/blog/posts/2026-01-01-test-post.md
npm run build
```

Expected: `_site/blog/index.html` shows "Posts coming soon." No `_site/blog/test-owner-financing/` directory.

- [ ] **Step 5: Commit**

```bash
git add src/blog/index.njk src/_includes/partials/blog-card.njk
git commit -m "feat: add blog listing page and card partial"
```

---

## Task 4: Blog CSS

**Files:**
- Modify: `assets/css/styles.css`

- [ ] **Step 1: Add blog styles at the end of `assets/css/styles.css`**

Append to the end of the file:

```css
/* ─── BLOG CARD ──────────────────────────────────────── */
.blog-card {
  display: flex;
  flex-direction: column;
  border-radius: var(--radius-card);
  border: 1px solid var(--color-border);
  overflow: hidden;
  text-decoration: none;
  color: var(--color-text-dark);
  transition: box-shadow 0.2s ease, transform 0.2s ease;
  background: var(--color-white);
}

.blog-card:hover {
  box-shadow: 0 4px 20px rgba(0,0,0,0.10);
  transform: translateY(-2px);
}

.blog-card__photo {
  aspect-ratio: 16/9;
  overflow: hidden;
  background: var(--color-sand);
}

.blog-card__photo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.35s ease;
}

.blog-card:hover .blog-card__photo img {
  transform: scale(1.03);
}

.blog-card__photo-placeholder {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, var(--color-sand) 0%, var(--color-sand-dark) 100%);
}

.blog-card__body {
  padding: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  flex: 1;
}

.blog-card__date {
  font-size: 0.78rem;
  color: var(--color-text-muted);
  margin: 0;
}

.blog-card__title {
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.35;
  margin: 0;
}

.blog-card__excerpt {
  font-size: 0.88rem;
  color: var(--color-text-muted);
  line-height: 1.55;
  margin: 0;
  flex: 1;
}

.blog-card__link {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--color-terra-dark);
  margin-top: var(--space-2);
}

/* ─── BLOG POST PAGE ─────────────────────────────────── */
.blog-post__hero {
  width: 100%;
  max-height: 420px;
  overflow: hidden;
}

.blog-post__hero-img {
  width: 100%;
  height: 420px;
  object-fit: cover;
  display: block;
}

.blog-post__inner {
  max-width: 720px;
  margin: 0 auto;
  padding: var(--space-10) 0 var(--space-16);
}

.blog-post__breadcrumb {
  font-size: 0.82rem;
  color: var(--color-text-muted);
  margin-bottom: var(--space-5);
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  align-items: center;
}

.blog-post__breadcrumb a {
  color: var(--color-text-muted);
  text-decoration: none;
}

.blog-post__breadcrumb a:hover {
  color: var(--color-terra-dark);
}

.blog-post__title {
  font-size: clamp(1.5rem, 4vw, 2.25rem);
  font-weight: 800;
  line-height: 1.2;
  margin: 0 0 var(--space-3);
}

.blog-post__meta {
  font-size: 0.82rem;
  color: var(--color-text-muted);
  margin: 0 0 var(--space-8);
}

.blog-post__body {
  font-size: 1.05rem;
  line-height: 1.75;
}

.blog-post__body p { margin: 0 0 var(--space-5); }
.blog-post__body h2 { font-size: 1.35rem; font-weight: 700; margin: var(--space-8) 0 var(--space-3); }
.blog-post__body h3 { font-size: 1.1rem; font-weight: 700; margin: var(--space-6) 0 var(--space-2); }
.blog-post__body strong { font-weight: 700; }
.blog-post__body ul, .blog-post__body ol { padding-left: 1.5rem; margin: 0 0 var(--space-5); }
.blog-post__body li { margin-bottom: var(--space-2); }

.blog-post__cta {
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-card);
  padding: var(--space-6) var(--space-7);
  background: var(--color-sand-light);
  margin-top: var(--space-10);
}

.blog-post__cta-heading {
  font-weight: 700;
  font-size: 1.05rem;
  margin: 0 0 var(--space-2);
}

.blog-post__cta-sub {
  font-size: 0.9rem;
  color: var(--color-text-muted);
  margin: 0 0 var(--space-4);
}

.blog-post__photo-credit {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  margin-top: var(--space-6);
}

.blog-post__photo-credit a {
  color: var(--color-text-muted);
}

/* Blog grid — 2 cols at md, stays 2 at lg (not 3) */
@media (min-width: 1024px) {
  .blog-grid { grid-template-columns: repeat(2, 1fr); }
}
```

- [ ] **Step 2: Build and do a quick visual check of the listing page**

```bash
npm run build && npm run dev
```

Open `http://localhost:8080/blog/` — page should load without errors. Add a test post temporarily to see the card render if needed.

- [ ] **Step 3: Commit**

```bash
git add assets/css/styles.css
git commit -m "feat: add blog card and blog post page CSS"
```

---

## Task 5: Initialize data files and voice guide

**Files:**
- Create: `data/blog-topics.json`
- Create: `data/blog-subreddits.json`
- Create: `docs/blog-voice.md`

- [ ] **Step 1: Create the topics tracker**

Create `data/blog-topics.json`:

```json
[]
```

- [ ] **Step 2: Create the subreddit list**

Create `data/blog-subreddits.json`:

```json
["landinvesting", "OffGrid", "homesteading", "vandwellers"]
```

- [ ] **Step 3: Create the voice guide**

Create `docs/blog-voice.md` with Tyler's full voice guide:

```markdown
# Tyler's writing voice guide

Source of truth for writing voice. Apply with judgment. Spirit over letter. Always.

---

## 1. WRITING RULES

Write like a sharp human who happens to be typing.

**Pacing & rhythm:**
- Short paragraphs. 1-2 sentences default. 3 max.
- Get to the point. No warm-up laps.
- Vary sentence length. Short punchy lines mixed with longer ones. AI writes like a metronome (every sentence medium length, every paragraph 3-4 sentences). Break that rhythm.
- Start sentences with And, But, Like, So. Write as you speak. New paragraph = "but" or "therefore" in spirit, not always in letter.
- If you've made your point, stop. Don't summarize what someone just read 2 paragraphs ago.

**Voice & tone:**
- Use contractions naturally (don't, can't, won't, it's).
- Use "I" and "you." Direct address. Active voice.
- Be specific. Numbers, names, concrete details. Specific writing is sharp writing.
- When uncertain, say so plainly ("I think," "probably," "maybe," "kinda").
- Never pad output to seem thorough. Shorter and accurate beats longer and fluffy.
- Take a stance. Commit.
- Give real examples. Point to something that actually happened. Skip hypotheticals.
- Use physical verbs for abstract processes. Say "sanded down," "bolted on," "stripped back."
- Humor comes from specificity. Be unexpectedly precise.
- Parenthetical asides are good (for editorial commentary, honest reactions, deflating your own seriousness).
- Natural transitions only. No mechanical connectors.

---

## 2. FORMATTING RULES

- Short paragraphs (1-2 sentences default, 3 max).
- Numbers as digits (3 years, 10 tools, 500 users).
- Contractions always.
- **NO em dashes.** Use commas, periods, colons, semicolons, or parentheses.
- Bold sparingly: 1-2 key moments per section.
- Use formatting like salt. Headers, bullets, numbered lists: only when they earn it.
- If you've made your point, stop. Don't add a summary paragraph restating everything.

---

## 3. BANNED LIST

If even ONE of these appears, the output fails.

### 3A. Dead AI vocabulary

delve, realm, harness, unlock, tapestry, paradigm, cutting-edge, revolutionize, landscape (abstract), intricate/intricacies, showcasing, crucial, pivotal, surpass, meticulously, vibrant, unparalleled, underscore (verb), leverage, synergy, innovative, game-changer, testament, commendable, meticulous, highlight (verb), emphasize, boast, groundbreaking, align, foster, showcase, enhance, holistic, garner, accentuate, pioneering, trailblazing, unleash, versatile, transformative, redefine, seamless, optimize, scalable, robust, breakthrough, empower, streamline, frictionless, elevate, adaptive, effortless, data-driven, insightful, proactive, mission-critical, visionary, disruptive, reimagine, unprecedented, intuitive, leading-edge, synergize, democratize, accelerate, state-of-the-art, dynamic, immersive, predictive, transparent, proprietary, integrated, plug-and-play, turnkey, future-proof, paradigm-shifting, supercharge, enduring, interplay, valuable, captivate

Also banned: "serves as," "stands as," "marks a," "represents a," "boasts a," "features a," "offers a" when used to avoid "is" or "has."

### 3B. Dead phrases

- "In today's [anything]..."
- "It's important to note that..." / "It's worth noting..."
- "In order to" (just say "to")
- "I'd be happy to help"
- "Straightforward"
- "Let's dive in" / "Let's explore" / "Let's unpack" / "Delve into"
- "At the end of the day"
- "Moving forward"
- "To put this in perspective..."
- "What makes this particularly interesting is..."
- "The implications here are..."
- "In other words..."
- "It goes without saying..."
- "Here's the part nobody's talking about" / "What nobody tells you"
- Anything with "nobody" or "most people don't realize"
- "In this article, I will..." (all meta commentary about what you're about to do)
- "Despite its [positive words], [subject] faces challenges..."

### 3C. Dead transitions

- "Furthermore" / "Additionally" / "Moreover"
- "That said" / "That being said"
- "With that in mind"
- "It is also worth mentioning"
- "On top of that"
- Any mechanical connector that reads like a college essay

### 3D. Engagement bait

- "Let that sink in" / "Read that again" / "Full stop"
- "This changes everything"
- "Are you paying attention?" / "You're not ready for this"

### 3E. Hype language

- "Supercharge" / "Unlock" / "Future-proof"
- "10x your [anything]"
- "Game-changer" / "Cutting-edge"

### 3F. THE BIG ONE (FATAL) — Negative parallelisms

**The banned patterns:**
- "This isn't X. This is Y."
- "Not X. Y."
- "Forget X. This is Y."
- "Less X, more Y."
- "Not only X, but also Y."
- "It's not just about X, it's about Y."
- "No X, no Y, just Z."
- "Stop thinking X. Start thinking Y."
- ANY sentence that negates one framing then asserts a corrected one.

**The fix:** delete everything before the positive claim. If you wrote "It's not about the prompt. It's about the context," just write "It's about the context."

---

## 4. AI WRITING PATTERNS TO AVOID

### 4A. Puffery & significance inflation
State the fact. Let the reader judge significance.

### 4B. Rule of three
Use 2 things. Or 4. Or just say the one thing that matters.

### 4C. False ranges
"From ancient traditions to modern innovations." Delete it.

### 4D. Elegant variation
Just use the name again. Forced synonyms are worse than repetition.

### 4E. Meta commentary
Say the thing. Don't announce that you're about to say the thing.

### 4F. Superficial analysis via participle phrases
Delete "-ing" phrases used to create fake depth.

### 4G. Knowledge-cutoff disclaimers
Never include these.

### 4H. Collaborative communication leakage
"I hope this helps!" — strip it.

### 4I. Metronome rhythm
Real writing breathes unevenly. Short. Then longer. Then a fragment.

### 4J. Copulative avoidance
Just say "is." Simple verbs work.

---

## 5. ANTI-OVERFITTING GUIDE

**HARD RULE:** Never violate. Banned words, structures, phrases. Absolute.
**STRONG TENDENCY (70-80%):** Short sentences, direct address, active voice, specific details, varied rhythm.
**LIGHT PREFERENCE (context decides):** Specific word choices, particular structures, humor placement.

**The litmus test:** "Does this sound like something I would actually write, or does it sound like an AI trying very hard to imitate me?" If it feels forced, pull back.
```

- [ ] **Step 4: Commit**

```bash
git add data/blog-topics.json data/blog-subreddits.json docs/blog-voice.md
git commit -m "feat: add blog data files and voice guide"
```

---

## Task 6: Install dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the Anthropic SDK**

```bash
npm install @anthropic-ai/sdk
```

- [ ] **Step 2: Add `blog:generate` script and update test command in `package.json`**

In `package.json`, update the `scripts` section:

```json
"scripts": {
  "dev": "eleventy --serve",
  "build": "eleventy",
  "sync": "node scripts/sync.mjs",
  "blog:generate": "node scripts/blog-generator.mjs",
  "test": "node --test tests/data.test.mjs tests/sync.test.mjs tests/blog-generator.test.mjs",
  "test:build": "npm run build && node --test tests/build.test.mjs"
}
```

- [ ] **Step 3: Verify install**

```bash
node -e "import('@anthropic-ai/sdk').then(() => console.log('ok'))"
```

Expected: `ok`

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: add @anthropic-ai/sdk dependency"
```

---

## Task 7: Reddit scraping module + tests

**Files:**
- Create: `scripts/lib/reddit.mjs`
- Create: `tests/blog-generator.test.mjs` (partial — reddit tests)

- [ ] **Step 1: Write the failing tests first**

Create `tests/blog-generator.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isQuestion, scorePost, filterAndScorePosts } from '../scripts/lib/reddit.mjs';

// ── isQuestion ────────────────────────────────────────────
test('isQuestion: title ending with ? is a question', () => {
  assert.ok(isQuestion({ title: 'How does owner financing work?' }));
});
test('isQuestion: title starting with "Can" is a question', () => {
  assert.ok(isQuestion({ title: 'Can you live on vacant land you own' }));
});
test('isQuestion: statement is not a question', () => {
  assert.ok(!isQuestion({ title: 'Bought my first piece of land today' }));
});
test('isQuestion: empty title is not a question', () => {
  assert.ok(!isQuestion({ title: '' }));
});

// ── scorePost ─────────────────────────────────────────────
test('scorePost: score = upvotes + (comments * 2)', () => {
  assert.equal(scorePost({ score: 100, num_comments: 50 }), 200);
});
test('scorePost: handles missing fields gracefully', () => {
  assert.equal(scorePost({}), 0);
});

// ── filterAndScorePosts ───────────────────────────────────
test('filterAndScorePosts: keeps only questions', () => {
  const posts = [
    { title: 'How does zoning work?', score: 10, num_comments: 5 },
    { title: 'Bought land today!', score: 999, num_comments: 100 },
  ];
  const result = filterAndScorePosts(posts);
  assert.equal(result.length, 1);
  assert.ok(result[0].title.includes('zoning'));
});
test('filterAndScorePosts: sorts by score descending', () => {
  const posts = [
    { title: 'What is zoning?', score: 10, num_comments: 5 },
    { title: 'Can I build a house?', score: 50, num_comments: 20 },
  ];
  const result = filterAndScorePosts(posts);
  assert.equal(result[0].title, 'Can I build a house?');
});
test('filterAndScorePosts: attaches _score to each result', () => {
  const posts = [{ title: 'What is APN?', score: 20, num_comments: 10 }];
  const result = filterAndScorePosts(posts);
  assert.equal(result[0]._score, 40);
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
node --test tests/blog-generator.test.mjs
```

Expected: `ERR_MODULE_NOT_FOUND` — `reddit.mjs` doesn't exist yet.

- [ ] **Step 3: Create the Reddit module**

Create `scripts/lib/reddit.mjs`:

```js
const USER_AGENT = 'LandToLandBlogBot/1.0 (github.com/tylerqbush/land-to-land-website)';

export async function fetchSubredditQuestions(subreddit) {
  const url = `https://www.reddit.com/r/${subreddit}/top.json?t=month&limit=50`;
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
  });
  if (!res.ok) throw new Error(`Reddit API ${res.status} for r/${subreddit}`);
  const data = await res.json();
  return data.data.children.map((c) => c.data);
}

export function isQuestion(post) {
  const title = (post.title || '').trim();
  if (!title) return false;
  if (title.endsWith('?')) return true;
  return /^(how|what|why|when|where|can|should|is|are|do|does|will|would)\b/i.test(title);
}

export function scorePost(post) {
  return (post.score || 0) + (post.num_comments || 0) * 2;
}

export function filterAndScorePosts(posts) {
  return posts
    .filter(isQuestion)
    .map((p) => ({ ...p, _score: scorePost(p) }))
    .sort((a, b) => b._score - a._score);
}

export async function fetchTopComments(subreddit, postId) {
  const url = `https://www.reddit.com/r/${subreddit}/comments/${postId}.json?limit=10`;
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
  });
  if (!res.ok) return [];
  const data = await res.json();
  const comments = data[1]?.data?.children ?? [];
  return comments
    .filter((c) => c.kind === 't1' && c.data.body && c.data.score > 0)
    .slice(0, 5)
    .map((c) => c.data.body);
}
```

- [ ] **Step 4: Run tests and confirm they pass**

```bash
node --test tests/blog-generator.test.mjs
```

Expected: all 8 tests pass with `▶ ok`.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/reddit.mjs tests/blog-generator.test.mjs
git commit -m "feat: add Reddit scraping module with tests"
```

---

## Task 8: Claude generation module + tests

**Files:**
- Create: `scripts/lib/claude.mjs`
- Modify: `tests/blog-generator.test.mjs` (add claude tests)

- [ ] **Step 1: Write failing tests for `extractKeywords`**

Append to `tests/blog-generator.test.mjs`:

```js
import { extractKeywords } from '../scripts/lib/claude.mjs';

// ── extractKeywords ───────────────────────────────────────
test('extractKeywords: returns meaningful words from a question', () => {
  const result = extractKeywords('How does owner financing work on vacant land?');
  assert.ok(result.includes('owner') || result.includes('financing') || result.includes('vacant') || result.includes('land'));
});
test('extractKeywords: filters stop words', () => {
  const result = extractKeywords('How does owner financing work on vacant land?');
  assert.ok(!result.includes('how'));
  assert.ok(!result.includes('does'));
  assert.ok(!result.includes('on'));
});
test('extractKeywords: returns fallback for empty question', () => {
  assert.equal(extractKeywords(''), 'vacant land');
});
test('extractKeywords: handles question with only stop words', () => {
  assert.equal(extractKeywords('What is it?'), 'vacant land');
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
node --test tests/blog-generator.test.mjs
```

Expected: `ERR_MODULE_NOT_FOUND` for claude.mjs.

- [ ] **Step 3: Create the Claude module**

Create `scripts/lib/claude.mjs`:

```js
import Anthropic from '@anthropic-ai/sdk';
import { readFile } from 'node:fs/promises';

const STOP_WORDS = new Set([
  'how', 'what', 'why', 'when', 'where', 'can', 'should', 'is', 'are',
  'do', 'does', 'will', 'would', 'the', 'a', 'an', 'in', 'on', 'at',
  'to', 'for', 'of', 'and', 'or', 'you', 'i', 'we', 'it', 'if',
  'that', 'this', 'with', 'from', 'your', 'my', 'their', 'our',
]);

export function extractKeywords(question) {
  const words = question
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOP_WORDS.has(w));
  return words.slice(0, 3).join(' ') || 'vacant land';
}

export async function generateBlogPost(question, comments, voiceGuidePath) {
  const voiceGuide = await readFile(voiceGuidePath, 'utf8');

  const systemPrompt = `You are a ghostwriter for Tyler Quackenbush, a land investor in Georgia who runs Land to Land Holdings LLC. You write buyer-education blog posts in his voice. Tyler buys vacant land at 25-40% of market value and sells with owner financing. His active markets are Putnam County FL, Luna County NM, and Klamath County OR. Buyers typically come from Facebook ads and browse on mobile.

VOICE GUIDE — follow every rule exactly:
${voiceGuide}

Return ONLY the blog post body. No title. No frontmatter. No "In conclusion" paragraph. No meta-commentary about what you're about to write. Start directly with the first sentence of the post. 500-800 words.`;

  const userMessage = `Write a blog post answering this question from a land buyer:

QUESTION: ${question}

CONTEXT (top Reddit comments — use these to understand what people actually want to know, but do not reference Reddit in the post):
${comments.map((c, i) => `${i + 1}. ${c}`).join('\n\n')}

Answer directly and plainly as Tyler would. Lead with the answer.`;

  const client = new Anthropic();
  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  return message.content[0].text;
}
```

- [ ] **Step 4: Run tests and confirm they pass**

```bash
node --test tests/blog-generator.test.mjs
```

Expected: all 12 tests pass. (`extractKeywords` tests pass; previous reddit tests still pass.)

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/claude.mjs tests/blog-generator.test.mjs
git commit -m "feat: add Claude post generation module with tests"
```

---

## Task 9: Unsplash download module + tests

**Files:**
- Create: `scripts/lib/unsplash.mjs`
- Modify: `tests/blog-generator.test.mjs` (add unsplash tests)

- [ ] **Step 1: Write failing tests**

Append to `tests/blog-generator.test.mjs`:

```js
import { extractImageMeta } from '../scripts/lib/unsplash.mjs';

// ── extractImageMeta ──────────────────────────────────────
test('extractImageMeta: extracts fields from Unsplash photo object', () => {
  const photo = {
    urls: { regular: 'https://images.unsplash.com/photo-123?w=1080' },
    user: { name: 'Jane Doe', username: 'janedoe' },
    links: { html: 'https://unsplash.com/photos/abc' },
  };
  const meta = extractImageMeta(photo);
  assert.equal(meta.url, 'https://images.unsplash.com/photo-123?w=1080');
  assert.equal(meta.authorName, 'Jane Doe');
  assert.equal(meta.authorUsername, 'janedoe');
  assert.equal(meta.unsplashUrl, 'https://unsplash.com/photos/abc');
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
node --test tests/blog-generator.test.mjs
```

Expected: `ERR_MODULE_NOT_FOUND` for unsplash.mjs.

- [ ] **Step 3: Create the Unsplash module**

Create `scripts/lib/unsplash.mjs`:

```js
import { createWriteStream, mkdirSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { dirname } from 'node:path';

export function extractImageMeta(photo) {
  return {
    url: photo.urls.regular,
    authorName: photo.user.name,
    authorUsername: photo.user.username,
    unsplashUrl: photo.links.html,
  };
}

export async function searchUnsplash(keywords, accessKey) {
  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(keywords)}&client_id=${accessKey}&per_page=3&orientation=landscape`;
  const res = await fetch(url, {
    headers: { 'Accept-Version': 'v1' },
  });
  if (!res.ok) throw new Error(`Unsplash API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const photo = data.results?.[0];
  if (!photo) throw new Error(`No Unsplash photo found for keywords: ${keywords}`);
  return extractImageMeta(photo);
}

export async function downloadImage(imageUrl, destPath) {
  mkdirSync(dirname(destPath), { recursive: true });
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`Image download failed: ${res.status}`);
  await pipeline(res.body, createWriteStream(destPath));
}
```

- [ ] **Step 4: Run tests and confirm they pass**

```bash
node --test tests/blog-generator.test.mjs
```

Expected: all 13 tests pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/unsplash.mjs tests/blog-generator.test.mjs
git commit -m "feat: add Unsplash photo download module with tests"
```

---

## Task 10: Main blog generator script + tests

**Files:**
- Create: `scripts/blog-generator.mjs`
- Modify: `tests/blog-generator.test.mjs` (add generator logic tests)

- [ ] **Step 1: Write failing tests for generator logic**

Append to `tests/blog-generator.test.mjs`:

```js
import { isCovered, slugifyQuestion, buildFrontmatter } from '../scripts/blog-generator.mjs';

// ── isCovered ─────────────────────────────────────────────
test('isCovered: returns true when exact question already in topics', () => {
  const topics = [{ question: 'How does owner financing work?', slug: 'how-does-owner-financing-work' }];
  assert.ok(isCovered('How does owner financing work?', topics));
});
test('isCovered: case-insensitive match', () => {
  const topics = [{ question: 'How does owner financing work?', slug: 'x' }];
  assert.ok(isCovered('HOW DOES OWNER FINANCING WORK?', topics));
});
test('isCovered: returns false when question not in topics', () => {
  const topics = [{ question: 'What is APN?', slug: 'what-is-apn' }];
  assert.ok(!isCovered('How does owner financing work?', topics));
});
test('isCovered: returns false for empty topics', () => {
  assert.ok(!isCovered('Any question?', []));
});

// ── slugifyQuestion ───────────────────────────────────────
test('slugifyQuestion: removes question mark', () => {
  const slug = slugifyQuestion('How does owner financing work?');
  assert.ok(!slug.includes('?'));
});
test('slugifyQuestion: produces kebab-case', () => {
  const slug = slugifyQuestion('How does owner financing work?');
  assert.match(slug, /^[a-z0-9-]+$/);
});
test('slugifyQuestion: truncates to 80 chars max', () => {
  const long = 'A'.repeat(200) + '?';
  assert.ok(slugifyQuestion(long).length <= 80);
});

// ── buildFrontmatter ──────────────────────────────────────
test('buildFrontmatter: produces valid YAML block', () => {
  const fm = buildFrontmatter({
    title: 'How does owner financing work?',
    date: '2026-06-16',
    slug: 'how-does-owner-financing-work',
    redditUrl: 'https://reddit.com/r/landinvesting/comments/abc',
    excerpt: 'Owner financing lets buyers skip the bank.',
    imagePath: '/assets/blog/how-does-owner-financing-work/hero.jpg',
    imageCredits: { authorName: 'Jane Doe', unsplashUrl: 'https://unsplash.com/photos/abc' },
  });
  assert.ok(fm.startsWith('---\n'));
  assert.ok(fm.includes('title:'));
  assert.ok(fm.includes('slug: how-does-owner-financing-work'));
  assert.ok(fm.includes('date: 2026-06-16'));
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
node --test tests/blog-generator.test.mjs
```

Expected: `ERR_MODULE_NOT_FOUND` for blog-generator.mjs exports.

- [ ] **Step 3: Create the main generator script**

Create `scripts/blog-generator.mjs`:

```js
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { slugify } from './lib/utils.mjs';
import { fetchSubredditQuestions, filterAndScorePosts, fetchTopComments } from './lib/reddit.mjs';
import { generateBlogPost, extractKeywords } from './lib/claude.mjs';
import { searchUnsplash, downloadImage } from './lib/unsplash.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

export function slugifyQuestion(question) {
  return slugify(question.replace(/\?/g, '').trim()).substring(0, 80);
}

export function isCovered(question, topics) {
  const q = question.toLowerCase();
  return topics.some((t) => t.question.toLowerCase() === q);
}

export function buildFrontmatter({ title, date, slug, redditUrl, excerpt, imagePath, imageCredits }) {
  const lines = [
    '---',
    `title: "${title.replace(/"/g, '\\"')}"`,
    `date: ${date}`,
    `slug: ${slug}`,
    `reddit_source: "${redditUrl}"`,
    `tags: [land-buying]`,
    `excerpt: "${excerpt.replace(/"/g, '\\"')}"`,
    `image: "${imagePath}"`,
    `image_credit_name: "${imageCredits.authorName}"`,
    `image_credit_url: "${imageCredits.unsplashUrl}"`,
    '---',
    '',
  ];
  return lines.join('\n');
}

function buildExcerpt(body) {
  return body
    .replace(/\n/g, ' ')
    .replace(/\*\*/g, '')
    .trim()
    .substring(0, 160)
    .replace(/\s+\S*$/, '...');
}

async function loadJSON(path, fallback) {
  if (!existsSync(path)) return fallback;
  return JSON.parse(await readFile(path, 'utf8'));
}

async function main() {
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;
  if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not set');
  if (!UNSPLASH_ACCESS_KEY) throw new Error('UNSPLASH_ACCESS_KEY not set');

  const subreddits = await loadJSON(join(ROOT, 'data', 'blog-subreddits.json'), ['landinvesting']);
  const topics = await loadJSON(join(ROOT, 'data', 'blog-topics.json'), []);

  // Scrape Reddit
  let allPosts = [];
  for (const sub of subreddits) {
    try {
      const posts = await fetchSubredditQuestions(sub);
      allPosts.push(...posts.map((p) => ({ ...p, _subreddit: sub })));
    } catch (err) {
      console.warn(`Warning: r/${sub} scrape failed: ${err.message}`);
    }
  }

  const scored = filterAndScorePosts(allPosts);
  const uncovered = scored.filter((p) => !isCovered(p.title, topics));

  // Fallback: manual queue
  if (uncovered.length === 0) {
    const queue = await loadJSON(join(ROOT, 'data', 'blog-queue.json'), []);
    if (queue.length === 0) {
      console.log('No new topics from Reddit and queue is empty. Nothing to generate.');
      process.exit(0);
    }
    const queued = queue[0];
    uncovered.push({ title: queued.question, _subreddit: 'landinvesting', id: null, permalink: '' });
  }

  const chosen = uncovered[0];
  const date = new Date().toISOString().split('T')[0];
  const slug = slugifyQuestion(chosen.title);
  const redditUrl = chosen.permalink ? `https://reddit.com${chosen.permalink}` : '';

  // Fetch comments for context
  const comments = chosen.id
    ? await fetchTopComments(chosen._subreddit, chosen.id).catch(() => [])
    : [];

  // Generate post body
  const voiceGuidePath = join(ROOT, 'docs', 'blog-voice.md');
  const body = await generateBlogPost(chosen.title, comments, voiceGuidePath);

  // Unsplash photo
  const keywords = extractKeywords(chosen.title);
  const imageCredits = await searchUnsplash(keywords, UNSPLASH_ACCESS_KEY);
  const imgDest = join(ROOT, 'assets', 'blog', slug, 'hero.jpg');
  await downloadImage(imageCredits.url, imgDest);

  const excerpt = buildExcerpt(body);
  const imagePath = `/assets/blog/${slug}/hero.jpg`;

  const frontmatter = buildFrontmatter({ title: chosen.title, date, slug, redditUrl, excerpt, imagePath, imageCredits });

  // Write post file
  const postPath = join(ROOT, 'src', 'blog', 'posts', `${date}-${slug}.md`);
  await mkdir(dirname(postPath), { recursive: true });
  await writeFile(postPath, frontmatter + body);
  console.log(`Generated: ${postPath}`);

  // Update topics tracker
  topics.push({ question: chosen.title, slug, reddit_source: redditUrl, published: date });
  await writeFile(join(ROOT, 'data', 'blog-topics.json'), JSON.stringify(topics, null, 2));

  // Write meta file for GitHub Action
  await writeFile(
    join(ROOT, 'data', '.blog-draft-meta.json'),
    JSON.stringify({ slug, title: chosen.title, date }, null, 2)
  );
}

// Only run main() when executed directly, not when imported by tests
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
```

- [ ] **Step 4: Run all tests and confirm they pass**

```bash
node --test tests/blog-generator.test.mjs
```

Expected: all 23 tests pass.

- [ ] **Step 5: Run full test suite**

```bash
npm test
```

Expected: all tests pass across all test files.

- [ ] **Step 6: Commit**

```bash
git add scripts/blog-generator.mjs tests/blog-generator.test.mjs
git commit -m "feat: add blog generator main script with tests"
```

---

## Task 11: GitHub Actions workflow

**Files:**
- Create: `.github/workflows/blog-generator.yml`

- [ ] **Step 1: Create the workflow**

Create `.github/workflows/blog-generator.yml`:

```yaml
name: Blog post generator

on:
  schedule:
    - cron: '0 10 * * 1'   # Monday 6am ET (EDT, UTC-4). Change to '0 11 * * 1' in winter.
  workflow_dispatch:

jobs:
  generate:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write

    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          token: ${{ secrets.GITHUB_TOKEN }}

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run blog generator
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          UNSPLASH_ACCESS_KEY: ${{ secrets.UNSPLASH_ACCESS_KEY }}
        run: node scripts/blog-generator.mjs

      - name: Read draft metadata
        id: meta
        run: |
          SLUG=$(node -e "console.log(require('./data/.blog-draft-meta.json').slug)")
          TITLE=$(node -e "console.log(require('./data/.blog-draft-meta.json').title)")
          DATE=$(node -e "console.log(require('./data/.blog-draft-meta.json').date)")
          echo "slug=$SLUG" >> "$GITHUB_OUTPUT"
          echo "title=$TITLE" >> "$GITHUB_OUTPUT"
          echo "date=$DATE" >> "$GITHUB_OUTPUT"

      - name: Configure git
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"

      - name: Create branch and commit
        run: |
          BRANCH="blog/${{ steps.meta.outputs.date }}-${{ steps.meta.outputs.slug }}"
          git checkout -b "$BRANCH"
          git add src/blog/posts/ assets/blog/ data/blog-topics.json
          git commit -m "blog: ${{ steps.meta.outputs.title }}"
          git push origin "$BRANCH"

      - name: Open PR
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          gh pr create \
            --title "blog: ${{ steps.meta.outputs.title }}" \
            --body "Automated weekly blog post. Review the draft, edit anything that needs changing, then merge to publish.

          **Source:** Reddit scrape from r/landinvesting and related subreddits
          **Photo:** Downloaded from Unsplash (see post for attribution)

          Closing this PR without merging discards the draft. It will not be re-generated." \
            --base main \
            --head "blog/${{ steps.meta.outputs.date }}-${{ steps.meta.outputs.slug }}"
```

- [ ] **Step 2: Add the two required secrets in GitHub**

Go to the repo on GitHub: **Settings > Secrets and variables > Actions > New repository secret**

Add:
- `ANTHROPIC_API_KEY` — your Anthropic API key from console.anthropic.com
- `UNSPLASH_ACCESS_KEY` — your Unsplash access key from unsplash.com/oauth/applications

- [ ] **Step 3: Trigger a manual test run**

Go to GitHub: **Actions > Blog post generator > Run workflow > Run workflow**

Watch the run. Expected outcome:
- All 5 steps complete with green checkmarks
- A PR appears in the repo titled `blog: {question from Reddit}`
- PR contains a new file in `src/blog/posts/` and an image in `assets/blog/`

- [ ] **Step 4: Review and close the test PR**

Open the PR. Read the post. Close it (don't merge) since it's a test run. The `data/blog-topics.json` entry will remain in the branch but won't affect main.

- [ ] **Step 5: Commit the workflow file**

```bash
git add .github/workflows/blog-generator.yml
git commit -m "feat: add weekly blog generator GitHub Action"
```

- [ ] **Step 6: Run full test suite one final time**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 7: Push to main**

```bash
git push origin main
```

---

## Post-implementation checklist

- [ ] `/blog/` listing page renders on mobile with card grid
- [ ] `/blog/{slug}/` individual post renders with hero image, body, and CTA block
- [ ] GitHub Action appears under **Actions** tab with Monday schedule
- [ ] Manual dispatch works end-to-end and produces a PR
- [ ] Post body has no banned words, no em dashes, no negative parallelisms
- [ ] Unsplash image committed to `assets/blog/`, not hotlinked
- [ ] `data/blog-topics.json` updated so no topic repeats
- [ ] Lighthouse score on `/blog/` > 90 (`npm run test:build` after merging a real post)
