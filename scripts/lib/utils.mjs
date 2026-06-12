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

export function contentHash(obj) {
  const sorted = Object.fromEntries(Object.keys(obj).sort().map(k => [k, obj[k]]));
  return createHash('sha256').update(JSON.stringify(sorted)).digest('hex');
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
