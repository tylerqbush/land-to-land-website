import { createHash } from 'node:crypto';

export function slugify(str) {
  return String(str)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function generateSlug(acreage, city, county, state, id) {
  return [acreage, 'acre', slugify(city), slugify(county), slugify(state), id.toLowerCase()].join('-');
}

export function parseAcreage(sizeStr) {
  const match = String(sizeStr ?? '').match(/[\d.]+/);
  return match ? parseFloat(match[0]) : null;
}

export function parseGPS(gpsStr) {
  if (!gpsStr) return { lat: null, lng: null };
  const parts = String(gpsStr).split(',');
  const lat = parseFloat(parts[0]);
  const lng = parseFloat(parts[1]);
  return { lat: isNaN(lat) ? null : lat, lng: isNaN(lng) ? null : lng };
}

export function normalizeStatus(status) {
  return typeof status === 'string' ? status.trim() : '';
}

const PUBLISHABLE = new Set(['Active', 'Under Contract', 'Sold']);
export function isPublishable(status) {
  return PUBLISHABLE.has(normalizeStatus(status));
}

// Used by both property.njk CTAs (hero/pricing block, Full Specs card)
// to decide whether to show the GeekPay buy button or fall back to a
// contact link. Pulled out as a pure function so it has direct test
// coverage independent of whatever properties currently exist in
// Airtable (geekpay_url may be null for every real property at once).
export function showBuyButton(prop) {
  return Boolean(prop && prop.geekpay_url) && normalizeStatus(prop && prop.status) === 'Active';
}

export function contentHash(obj) {
  const sorted = JSON.stringify(obj, (_, v) =>
    v !== null && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]]))
      : v
  );
  return createHash('sha256').update(sorted).digest('hex');
}

export function photoHash(attachments) {
  if (!Array.isArray(attachments) || attachments.length === 0) return '';
  return attachments.map(a => a.id).join(',');
}

export function normalizeGeekpay(url) {
  if (!url || !String(url).trim()) return null;
  return String(url).trim();
}

export function diffRecords(fetchedMap, storedHashes) {
  const added = [], updated = [], unchanged = [], removed = [];
  for (const [id, hashes] of fetchedMap) {
    const stored = storedHashes[id];
    if (!stored) {
      added.push(id);
    } else if (stored.content !== hashes.content || stored.photos !== hashes.photos) {
      updated.push(id);
    } else {
      unchanged.push(id);
    }
  }
  for (const id of Object.keys(storedHashes)) {
    if (!fetchedMap.has(id)) removed.push(id);
  }
  return { added, updated, unchanged, removed };
}

// Internal data-entry notes sometimes end up in Airtable text fields, e.g.
// Zoning Designation = "R-2 Residential (per Jeff's site, confirm)". They
// are reminders for Tyler, not buyer-facing copy, so strip any
// parenthetical that attributes a value to someone's site ("(per X's
// site...)"). Deliberately narrow: legitimate buyer caveats such as
// "(confirm with the county)" are left alone.
export function stripInternalNotes(text) {
  if (typeof text !== 'string') return text;
  // Also swallow whitespace before a following . , ; : so removing the note
  // never leaves "Residential ." behind. Text with no note is returned
  // untouched (not even trimmed), so unrelated strings like ", .5 acres"
  // are never altered.
  const out = text.replace(
    /\s*\(\s*per\s+[^)]*\bsite\b[^)]*\)(\s*[.,;:])?/gi,
    (_match, punct) => (punct ? punct.trim() : '')
  );
  return out === text ? text : out.trim();
}

// Shallow copy of an Airtable fields object with stripInternalNotes
// applied to every string value. Non-strings (numbers, arrays,
// attachment objects) pass through untouched.
export function sanitizeFields(fields) {
  const out = {};
  for (const [k, v] of Object.entries(fields)) out[k] = stripInternalNotes(v);
  return out;
}

// Some Airtable photo sets lead with GIS/aerial/map screenshots and bury the
// real ground photos further down, but photos[0] drives the listing card, the
// page hero, and the gallery. data/primary-photos.json names the photo to lead
// with per property, by Airtable attachment filename (stable if photos are
// reordered, unlike a position). Returns photoPaths with that photo moved to
// the front and everything else kept in its original order. If the filename
// isn't found, or is already first, the original order is returned unchanged.
export function applyPrimaryPhoto(photoPaths, attachments, primaryFilename) {
  if (!primaryFilename || !Array.isArray(attachments)) return photoPaths;
  const idx = attachments.findIndex(a => a && a.filename === primaryFilename);
  if (idx <= 0 || idx >= photoPaths.length) return photoPaths;
  return [photoPaths[idx], ...photoPaths.slice(0, idx), ...photoPaths.slice(idx + 1)];
}
