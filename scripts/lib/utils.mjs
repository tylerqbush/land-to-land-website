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

// What a buyer pays to start: the down payment plus the one-time doc fee.
// Returns null unless both are real numbers, so a listing with a missing fee
// never shows a total that quietly leaves it out. The note fee and monthly
// property tax are not part of this; they are inside the monthly payment.
export function costToStart(prop) {
  if (!prop || prop.down == null || prop.doc_fee == null) return null;
  const down = Number(prop.down);
  const docFee = Number(prop.doc_fee);
  if (!Number.isFinite(down) || !Number.isFinite(docFee) || down < 0 || docFee < 0) return null;
  return { down, docFee, total: Math.round((down + docFee) * 100) / 100 };
}

// ── "What the county allows" table ────────────────────────────────────────
// The Airtable use fields are free text ("Yes, up to 21 days in each 6-month
// period", "Only with Temporary Residence Permit (...)"). classifyUse reads
// only the unambiguous cases into a status and always keeps the original
// wording as the note. Anything it can't read confidently is shown as
// written, with no status, rather than guessed at. Blank or "N/A" becomes
// "Ask the county".
const UNKNOWN_USE = /^(n\/a|na|unknown|not specified|tbd|\?)\.?$/i;
const LIMIT_WORDS = /\b(only|if|up to|limited|limit|max|must|unless|after|approved|approval|permit|newer|older|days?|weeks?|months?)\b/i;

function tidyNote(s) {
  let t = String(s).trim();
  if (t.startsWith('(') && t.endsWith(')')) t = t.slice(1, -1).trim();
  if (!t) return '';
  t = t.charAt(0).toUpperCase() + t.slice(1);
  return /[.!?]$/.test(t) ? t : `${t}.`;
}

export function classifyUse(raw) {
  const text = typeof raw === 'string' ? raw.trim() : '';
  if (!text || UNKNOWN_USE.test(text)) return { status: 'ask', note: '' };

  const yes = text.match(/^(?:yes|y)\b[\s,.:;!-]*([\s\S]*)$/i);
  if (yes) {
    const rest = tidyNote(yes[1]);
    if (!rest) return { status: 'yes', note: '' };
    return { status: LIMIT_WORDS.test(rest) ? 'limits' : 'yes', note: rest };
  }
  const no = text.match(/^(?:no|not)\b[\s,.:;!-]*([\s\S]*)$/i);
  if (no) return { status: 'no', note: tidyNote(no[1]) };
  if (/^(only|limited|up to|allowed|must|has to|have to|needs? to)\b/i.test(text)) {
    return { status: 'limits', note: tidyNote(text) };
  }
  return { status: 'info', note: tidyNote(text) };
}

// Rows for the table, grouped. "core" rows always appear (blank shows "Ask the
// county"); others appear only when Airtable has a value. kind "use" rows get
// a status; kind "info" rows (utilities, build timeline) just show the text.
const USE_ROWS = [
  { group: 'Homes and building', rows: [
    { key: 'single_family_allowed', label: 'Single-family home', kind: 'use', core: true },
    { key: 'manufactured_allowed', label: 'Manufactured home', kind: 'use', core: true },
    { key: 'modular_allowed', label: 'Modular home', kind: 'use' },
    { key: 'tiny_home_friendly', label: 'Tiny home', kind: 'use', core: true },
    { key: 'time_limit_to_build', label: 'Time to build', kind: 'info' },
  ] },
  { group: 'Camping and RVs', rows: [
    { key: 'tent_camping', label: 'Tent camping', kind: 'use', core: true },
    { key: 'camping_rv', label: 'RV camping', kind: 'use', core: true },
    { key: 'rv_while_build', label: 'RV while building', kind: 'use' },
    { key: 'full_time_rv', label: 'Full-time RV living', kind: 'use' },
    { key: 'hunting', label: 'Hunting', kind: 'use' },
  ] },
  { group: 'Utilities and land', rows: [
    { key: 'septic', label: 'Septic system', kind: 'use', core: true },
    { key: 'well', label: 'Drilling a well', kind: 'use' },
    { key: 'electricity', label: 'Power at the lot', kind: 'info' },
    { key: 'solar', label: 'Solar', kind: 'use' },
    { key: 'propane', label: 'Propane', kind: 'use' },
    { key: 'flood_plain', label: 'Flood zone', kind: 'info' },
  ] },
];

const CHIP_TEXT = { yes: 'Allowed', limits: 'Allowed, with limits', no: 'Not allowed', ask: 'Ask the county' };

export function allowedUses(prop) {
  const groups = [];
  let hasAnswers = false;
  for (const g of USE_ROWS) {
    const rows = [];
    for (const r of g.rows) {
      const raw = prop ? prop[r.key] : '';
      const filled = typeof raw === 'string' && raw.trim() !== '';
      if (!filled && !r.core) continue;
      let status, note;
      if (r.kind === 'use') {
        ({ status, note } = classifyUse(raw));
      } else if (!filled || UNKNOWN_USE.test(raw.trim())) {
        status = 'ask'; note = '';
      } else {
        status = 'info';
        note = r.key === 'flood_plain' && /^no\.?$/i.test(raw.trim()) ? 'Not in a flood zone.' : tidyNote(raw);
      }
      if (status !== 'ask') hasAnswers = true;
      rows.push({ label: r.label, status, chip: CHIP_TEXT[status] || '', note });
    }
    if (rows.length) groups.push({ title: g.group, rows });
  }
  return { groups, hasAnswers };
}

// The Airtable "Property Name" formula can come back blank (it did for every
// record after the pricing fields were restructured), which left every listing
// page with an empty heading. Use Airtable's name when it has one, otherwise
// build a plain one from fields that are always on the record. Never includes
// price, so it can't go stale.
export function listingName(name, acreage, city, state) {
  const given = typeof name === 'string' ? name.trim() : '';
  if (given) return given;
  const where = [city, state].filter(Boolean).join(', ');
  const size = acreage ? `${acreage} acre property` : 'Property';
  return where ? `${size} in ${where}` : size;
}
