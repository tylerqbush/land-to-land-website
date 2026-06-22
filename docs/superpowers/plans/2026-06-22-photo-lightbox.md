# Photo Lightbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clicking the "+X more" overlay on a property detail page's photo grid opens a full-screen lightbox that shows all of that property's photos with prev/next navigation, while the main photo and first thumbnail keep their current "open in new tab" behavior.

**Architecture:** A single hidden lightbox modal lives once in `property.njk`. The "+X more" link carries a `data-photos` JSON attribute (full photo URL array) and `data-index="2"`. A vanilla JS module (`assets/js/lightbox.js`) intercepts clicks on that one link, reads the data attributes, and renders/cycles through photos inside the modal. No JS framework, no new dependency.

**Tech Stack:** Eleventy/Nunjucks template, vanilla JS (IIFE, matches `assets/js/animations.js` style), plain CSS using existing design tokens in `assets/css/styles.css`.

---

## Reference: existing code being modified

`src/property/property.njk` lines 30-50 (the photo grid block) currently read:

```njk
      {# LEFT: static photo grid #}
      <div class="listing-photo-grid">
        <a href="{{ prop.photos[0] }}" target="_blank" rel="noopener" class="listing-photo-grid__main">
          <img src="{{ prop.photos[0] }}" alt="Main photo of {{ prop.name }}" fetchpriority="high" width="900" height="600">
        </a>
        {% if prop.photos.length > 1 %}
        <div class="listing-photo-grid__thumbs">
          <a href="{{ prop.photos[1] }}" target="_blank" rel="noopener" class="listing-photo-grid__thumb">
            <img src="{{ prop.photos[1] }}" alt="Photo 2 of {{ prop.name }}" loading="lazy" width="480" height="320">
          </a>
          {% if prop.photos.length > 2 %}
          <a href="{{ prop.photos[2] }}" target="_blank" rel="noopener" class="listing-photo-grid__thumb listing-photo-grid__thumb--more">
            <img src="{{ prop.photos[2] }}" alt="Photo 3 of {{ prop.name }}" loading="lazy" width="480" height="320">
            {% if prop.photos.length > 3 %}
            <span class="listing-photo-grid__count">+{{ prop.photos.length - 3 }} more</span>
            {% endif %}
          </a>
          {% endif %}
        </div>
        {% endif %}
      </div>
```

Only the inner `<a class="listing-photo-grid__thumb listing-photo-grid__thumb--more">` element changes (gets two new `data-*` attributes). Everything else in this block is untouched.

---

### Task 1: Add data attributes to the "+X more" link and lightbox modal markup

**Files:**
- Modify: `src/property/property.njk:41`, and add new markup after line 50 (end of `.listing-photo-grid` div, still inside `.listing-narrative-grid`)

- [ ] **Step 1: Add `data-photos` and `data-index` to the "+X more" anchor**

Replace line 41:

```njk
          <a href="{{ prop.photos[2] }}" target="_blank" rel="noopener" class="listing-photo-grid__thumb listing-photo-grid__thumb--more">
```

with:

```njk
          <a href="{{ prop.photos[2] }}" target="_blank" rel="noopener" class="listing-photo-grid__thumb listing-photo-grid__thumb--more js-lightbox-trigger" data-photos="{{ prop.photos | dump | escape }}" data-index="2">
```

Note: `prop.photos | dump` serializes the array to a JSON string (Nunjucks' `dump` filter does this). `| escape` HTML-escapes it so it's safe inside the `data-photos="..."` attribute (photo URLs won't contain quotes, but escaping is still correct practice for any string written into an HTML attribute).

- [ ] **Step 2: Add the lightbox modal markup**

Immediately after the closing `</div>` of `.listing-photo-grid` (the line right after line 50, before the blank line that precedes `{# RIGHT: narrative + feature bullets #}`), add:

```njk
      {# Lightbox modal — hidden by default, populated by assets/js/lightbox.js #}
      <div id="photo-lightbox" class="lightbox-overlay" hidden>
        <button type="button" class="lightbox-close" aria-label="Close">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
        <button type="button" class="lightbox-prev" aria-label="Previous photo">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <button type="button" class="lightbox-next" aria-label="Next photo">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
        <figure class="lightbox-figure">
          <img class="lightbox-img" src="" alt="">
          <figcaption class="lightbox-caption"></figcaption>
        </figure>
      </div>
```

- [ ] **Step 3: Add the page-specific script tag**

At the very end of `src/property/property.njk` (after the closing `</section>` of "Ask a Question", which is currently the last line), add:

```njk

<script src="/assets/js/lightbox.js" defer></script>
```

- [ ] **Step 4: Commit**

```bash
cd "/Users/tyler/Documents/Land to Land Website Repo"
git add src/property/property.njk
git commit -m "feat: add lightbox modal markup and data attributes to property template"
```

---

### Task 2: Write the lightbox JS module

**Files:**
- Create: `assets/js/lightbox.js`

- [ ] **Step 1: Write the module**

Create `assets/js/lightbox.js`:

```js
(function () {
  'use strict';

  var trigger = document.querySelector('.js-lightbox-trigger');
  var modal = document.getElementById('photo-lightbox');
  if (!trigger || !modal) return;

  var imgEl = modal.querySelector('.lightbox-img');
  var captionEl = modal.querySelector('.lightbox-caption');
  var closeBtn = modal.querySelector('.lightbox-close');
  var prevBtn = modal.querySelector('.lightbox-prev');
  var nextBtn = modal.querySelector('.lightbox-next');

  var photos = [];
  var index = 0;

  function render() {
    var total = photos.length;
    imgEl.src = photos[index];
    imgEl.alt = 'Property Image ' + (index + 1);
    captionEl.textContent = 'Property Image ' + (index + 1) + ' (' + (index + 1) + ' / ' + total + ')';
  }

  function open(startIndex, photoList) {
    photos = photoList;
    index = startIndex;
    render();
    modal.hidden = false;
  }

  function close() {
    modal.hidden = true;
  }

  function showPrev() {
    index = (index - 1 + photos.length) % photos.length;
    render();
  }

  function showNext() {
    index = (index + 1) % photos.length;
    render();
  }

  trigger.addEventListener('click', function (e) {
    e.preventDefault();
    var photoList = JSON.parse(trigger.getAttribute('data-photos'));
    var startIndex = parseInt(trigger.getAttribute('data-index'), 10);
    open(startIndex, photoList);
  });

  closeBtn.addEventListener('click', close);
  prevBtn.addEventListener('click', showPrev);
  nextBtn.addEventListener('click', showNext);

  modal.addEventListener('click', function (e) {
    if (e.target === modal) close();
  });

  document.addEventListener('keydown', function (e) {
    if (modal.hidden) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') showPrev();
    if (e.key === 'ArrowRight') showNext();
  });
})();
```

- [ ] **Step 2: Commit**

```bash
cd "/Users/tyler/Documents/Land to Land Website Repo"
git add assets/js/lightbox.js
git commit -m "feat: add vanilla JS lightbox module"
```

---

### Task 3: Add lightbox CSS

**Files:**
- Modify: `assets/css/styles.css` (append to end of file)

- [ ] **Step 1: Add the lightbox styles**

Append to `assets/css/styles.css`:

```css
/* ── PHOTO LIGHTBOX ── */
.lightbox-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.95);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-8);
}

.lightbox-overlay[hidden] { display: none; }

.lightbox-figure {
  max-width: 90vw;
  max-height: 80vh;
  margin: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
}

.lightbox-img {
  max-width: 90vw;
  max-height: 75vh;
  object-fit: contain;
  border-radius: var(--radius-card);
  display: block;
}

.lightbox-caption {
  color: var(--color-white);
  font-size: 14px;
  text-align: center;
}

.lightbox-close,
.lightbox-prev,
.lightbox-next {
  position: absolute;
  background: transparent;
  border: none;
  color: var(--color-white);
  cursor: pointer;
  padding: var(--space-2);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.85;
  transition: opacity 0.2s ease;
}

.lightbox-close:hover,
.lightbox-prev:hover,
.lightbox-next:hover {
  opacity: 1;
}

.lightbox-close {
  top: var(--space-6);
  right: var(--space-6);
}

.lightbox-prev {
  left: var(--space-6);
  top: 50%;
  transform: translateY(-50%);
}

.lightbox-next {
  right: var(--space-6);
  top: 50%;
  transform: translateY(-50%);
}

@media (max-width: 640px) {
  .lightbox-prev,
  .lightbox-next {
    padding: var(--space-1);
  }
  .lightbox-close {
    top: var(--space-4);
    right: var(--space-4);
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd "/Users/tyler/Documents/Land to Land Website Repo"
git add assets/css/styles.css
git commit -m "feat: add lightbox modal styles"
```

---

### Task 4: Manual verification

**Files:** none (verification only)

- [ ] **Step 1: Build and start the dev server**

```bash
cd "/Users/tyler/Documents/Land to Land Website Repo"
npm run build
npx eleventy --serve
```

- [ ] **Step 2: Find a property with more than 3 photos**

```bash
node -e "
const data = JSON.parse(require('fs').readFileSync('src/_data/properties.json'));
const p = data.find(p => p.photos.length > 3);
console.log(p.slug, p.photos.length);
"
```

- [ ] **Step 3: Open that property page in a browser and verify**

Navigate to `http://localhost:8080/property/{slug}/` (use the slug from Step 2) and confirm:
- Clicking the main photo opens the raw image in a new tab (unchanged behavior)
- Clicking the first thumbnail opens the raw image in a new tab (unchanged behavior)
- Clicking the "+X more" thumbnail opens the lightbox, showing photo 3 of N with the correct caption
- Right arrow / next button advances to photo 4, wrapping back to photo 1 after the last photo
- Left arrow / prev button goes backward, wrapping to the last photo from photo 1
- Escape key closes the lightbox
- Clicking the dark background (not the image) closes the lightbox
- Reload the page with JS disabled (or check the `href` in dev tools): the "+X more" link still points at the raw photo 3 URL

- [ ] **Step 4: Confirm no console errors**

Open browser dev tools console while testing Step 3, confirm no JS errors appear.

---

## Self-Review Notes

- Spec coverage: trigger restriction (Task 1 Step 1), no-JS fallback (href kept, JS calls preventDefault in Task 2), modal UI elements (Task 1 Step 2: close/prev/next/caption), wraparound navigation (Task 2 showPrev/showNext use modulo), file list (Tasks 1-3 match spec's file list exactly).
- No placeholders: every step has complete, runnable code.
- Type/name consistency: `data-photos`/`data-index` attribute names match between Task 1 (template) and Task 2 (JS reads same names). `.js-lightbox-trigger`, `#photo-lightbox`, `.lightbox-img`, `.lightbox-caption`, `.lightbox-close`, `.lightbox-prev`, `.lightbox-next` are used identically across Task 1 (markup) and Task 2 (querySelector calls).
