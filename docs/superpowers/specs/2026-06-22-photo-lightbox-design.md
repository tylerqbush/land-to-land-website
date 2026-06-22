# Photo Lightbox Design

**Goal:** Clicking the "+X more" overlay on a property detail page's photo grid opens a full-screen lightbox showing all of that property's photos, with navigation between them.

**Context:** The property detail page (`src/property/property.njk`) shows a photo grid: one large main photo and up to two thumbnails. If there are more than 3 photos, the second thumbnail shows a "+X more" count overlay. Currently all three links use `target="_blank"` to open the raw image in a new tab. This spec adds a lightbox for the overlay link only, as a progressive enhancement.

## Trigger

Only the "+X more" overlay link opens the lightbox. The main photo and first thumbnail keep their existing `target="_blank"` behavior unchanged.

## No-JS fallback

The "+X more" link keeps its `href` pointing at that photo. With JS disabled, clicking it behaves exactly as today (opens the raw image in a new tab). With JS enabled, the click handler calls `preventDefault()` and opens the lightbox instead.

## Lightbox UI

Full-screen dark overlay (matches the screenshot reference: near-black background, ~95% opacity):
- Centered image, max-width/max-height fit within viewport with padding, white border-radius corners
- Caption below image: `Property Image {N} ({N} / {total})`
- Close button (X) top-right corner
- Prev/next chevron arrows, vertically centered, left and right edges
- Clicking the dark background (outside the image) closes the lightbox
- Escape key closes the lightbox
- Left/Right arrow keys navigate prev/next, wrapping at both ends (last photo's "next" goes to photo 1, and vice versa)
- Clicking prev/next arrows does the same

## Data flow

The "+X more" overlay link gets a `data-photos` attribute containing the full JSON array of photo URLs for this property, and `data-index="2"` (0-based, since it's the 3rd photo in the grid). A single lightbox modal (hidden by default, `display: none`) lives once in the page markup, not per-photo.

On click:
1. JS reads `data-photos` (parses JSON) and `data-index` from the clicked link
2. Stores photos array and current index in module state
3. Renders the image at current index into the modal's `<img>` and updates caption text
4. Shows the modal (`display: flex`)

Prev/next update the index (with wraparound), re-render image src and caption, no need to re-open the modal.

## Files

- **Modify `src/property/property.njk`**: add `data-photos` and `data-index="2"` attributes to the existing "+X more" anchor; add the lightbox modal markup (image, caption, close button, prev/next arrows) once near the end of the photo grid block, hidden by default; include `<script src="/assets/js/lightbox.js" defer></script>` at the bottom of this template only.
- **Create `assets/js/lightbox.js`**: vanilla JS, no dependencies. Exposes no globals beyond its own event listeners. Self-contained: queries for `.listing-photo-grid__thumb--more` trigger, the modal, and its controls by class/id on `DOMContentLoaded`.
- **Modify `assets/css/styles.css`**: add lightbox modal styles (`.lightbox-overlay`, `.lightbox-img`, `.lightbox-caption`, `.lightbox-close`, `.lightbox-prev`, `.lightbox-next`), using existing design tokens for colors/spacing where applicable, with custom near-black/white values for the overlay itself to match the reference screenshot.

## Testing

No JS unit test framework exists in this project for frontend interactivity (Eleventy templates + vanilla JS). Verification is manual via the dev server: build, open a property page with more than 3 photos, click "+X more", confirm lightbox opens at the right photo, navigate prev/next including wraparound, close via X/Escape/background-click, and confirm the main photo and first thumbnail still open in a new tab unaffected.
