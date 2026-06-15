import { readFile, writeFile, mkdir, rm, rename, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createWriteStream } from 'node:fs';
import { join, dirname } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import {
  generateSlug,
  parseAcreage,
  parseGPS,
  normalizeStatus,
  isPublishable,
  contentHash,
  photoHash,
  normalizeGeekpay,
  diffRecords,
} from './lib/utils.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const BASE_ID = 'appE5El6Tgi6LS2Z6';
const TABLE_ID = 'tblIXORnaELK4K4w8';


async function fetchAllRecords(pat) {
  const records = [];
  let offset = null;

  do {
    const params = new URLSearchParams({
      filterByFormula: '{Ready for Website}=1',
      pageSize: '100',
    });
    if (offset) params.set('offset', offset);

    const url = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}?${params}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${pat}` },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Airtable API ${res.status}: ${body}`);
    }

    const data = await res.json();
    records.push(...data.records);
    offset = data.offset ?? null;
  } while (offset);

  return records;
}

function validateRecord(id, f) {
  const required = { city: f['City'], county: f['County'], state: f['State Abbreviation'], monthly: f['Easy Financing - per month'] };
  for (const [key, val] of Object.entries(required)) {
    if (val === undefined || val === null || val === '') {
      throw new Error(`Record ${id} is missing required field: ${key}`);
    }
  }
}

function generateDescription(f, acreage, city, county, state) {
  const areaContext = {
    'Klamath': `This property is located in Klamath County, Oregon${city ? ` near ${city}` : ''}. You're in the high desert of southern Oregon, a wide-open landscape of ponderosa pines, sage flats, and big sky that sits close to Crater Lake and the Sprague River Valley.`,
    'Luna': `This property is located in Luna County, New Mexico${city ? ` near ${city}` : ''}. The land sits in the Chihuahuan Desert at the foot of the Florida Mountains, with the kind of sweeping views and quiet solitude that's getting harder to find.`,
    'Putnam': `This property is located in Putnam County, Florida${city ? ` near ${city}` : ''}. You're in the heart of north-central Florida, a laid-back stretch of lakes, longleaf pine, and Spanish moss that moves at its own pace.`,
  };

  const opener = areaContext[county] || `This property is located in ${county} County, ${state}${city ? ` near ${city}` : ''}.`;
  const parts = [opener];

  const terrain = (f['Terrain'] ?? '').trim();
  const elevation = (f['Elevation'] ?? '').trim();
  if (terrain && elevation) {
    parts.push(`The terrain is ${terrain.toLowerCase()} at an elevation of ${elevation}.`);
  } else if (terrain) {
    parts.push(`The terrain is ${terrain.toLowerCase()}.`);
  } else if (elevation) {
    parts.push(`The property sits at an elevation of ${elevation}.`);
  }

  if (f['Access'] === 'Yes') parts.push('Road access is in place.');

  if (f['Zoning Designation']) parts.push(`Zoned ${f['Zoning Designation']}.`);

  return parts.join(' ');
}

function mapRecord(record, existingSlug) {
  const f = record.fields;
  const id = f['Product ID'] != null ? String(f['Product ID']) : null;
  if (!id) throw new Error(`Record has no Property ID: ${JSON.stringify(record.id)}`);

  validateRecord(id, f);

  const acreage = parseAcreage(f['Size']);
  const city = f['City'] ?? '';
  const county = f['County'] ?? '';
  const state = f['State Abbreviation'] ?? '';
  const { lat, lng } = parseGPS(f['GPS Coordinates']);
  const slug = existingSlug ?? generateSlug(acreage, city, county, state, id);

  return {
    id,
    name: f['Property Name'] ?? '',
    slug,
    status: normalizeStatus(f['Status']),
    acreage,
    city,
    county,
    state,
    lat,
    lng,
    gps: f['GPS Coordinates'] ?? '',
    monthly: f['Easy Financing - per month'] ?? null,
    term_months: f['Easy Financing - total no. of months'] ?? null,
    down: f['Down Payment'] ?? null,
    doc_fee: f['Processing Fee'] ?? null,
    cash_price: f['Cash Purchase Price'] ?? null,
    geekpay_url: normalizeGeekpay(f['GeekPay Checkout URL']),
    description: (() => { const d = f['Web Description']; const text = !d ? '' : typeof d === 'string' ? d.trim() : (d.text ?? '').trim(); return text || generateDescription(f, acreage, city, county, state); })(),
    apn: f['Parcel Number (APN)'] ?? '',
    address: f['Street Address'] ?? '',
    google_maps_url: f['Google Maps Link'] ?? '',
    annual_taxes: f['Annual Taxes'] ?? null,
    zoning: f['Zoning Designation'] ?? '',
    elevation: f['Elevation'] ?? '',
    terrain: f['Terrain'] ?? '',
    lot_dimensions: f['Lot Dimensions'] ?? '',
    time_limit_to_build: f['Time Limit to Build'] ?? '',
    single_family_allowed: f['Single Family Homes Allowed?'] ?? '',
    modular_allowed: f['Modular Homes Allowed?'] ?? '',
    manufactured_allowed: f['Manufactured Homes Allowed?'] ?? '',
    tiny_home_friendly: f['Tiny Home Friendly?'] ?? '',
    septic_required: f['Septic System Required to Building?'] ?? '',
    flood_plain: f['Property Located in a Flood Plain?'] ?? '',
    full_time_rv: f['Full-Time RV Living Allowed?'] ?? '',
    rv_while_build: f['RV Allowed on the Property While I Build?'] ?? '',
    camping_rv: f['Camping in an RV Allowed?'] ?? '',
    tent_camping: f['Tent Camping Allowed?'] ?? '',
    hunting: f['Hunting Allowed?'] ?? '',
    well: f['Allowable to Drill a Well?'] ?? '',
    septic: f['Is it allowable to install a septic system?'] ?? '',
    electricity: f['Currently have electricity?'] ?? '',
    solar: f['Solar Allowed?'] ?? '',
    propane: f['Propane Tanks Allowed?'] ?? '',
    gas: f['Currently have Gas?'] ?? '',
    road_access: f['Access'] ?? '',
    video_url: f['Featured Video'] ?? null,
    photos: [],
    seo_title: f['SEO-Title:'] ?? '',
    seo_description: f['SEO-Meta Description:'] ?? '',
    seo_keywords: f['SEO-Keywords'] ?? '',
  };
}

async function downloadPhoto(url, destPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Photo download failed ${res.status}: ${url}`);
  await mkdir(dirname(destPath), { recursive: true });
  const tmp = `${destPath}.tmp`;
  try {
    await pipeline(res.body, createWriteStream(tmp));
    await rename(tmp, destPath);
  } catch (err) {
    await unlink(tmp).catch(() => {});
    throw err;
  }
}

async function main() {
  const pat = process.env.AIRTABLE_PAT;
  if (!pat) throw new Error('AIRTABLE_PAT environment variable is not set');

  // Phase 1: Fetch
  console.log('Phase 1: Fetching from Airtable...');
  const raw = await fetchAllRecords(pat);
  const publishable = raw.filter(r => isPublishable(r.fields['Status'] ?? ''));
  console.log(`  Fetched ${raw.length} records, ${publishable.length} publishable`);

  // Phase 2: Diff
  console.log('Phase 2: Diffing against stored hashes...');
  const hashesPath = join(ROOT, 'data', 'hashes.json');
  const propsPath = join(ROOT, 'src', '_data', 'properties.json');

  const storedHashes = existsSync(hashesPath)
    ? JSON.parse(await readFile(hashesPath, 'utf8'))
    : {};

  // Load previous properties to preserve stable slugs by id
  const existingSlugs = {};
  if (existsSync(propsPath)) {
    const prev = JSON.parse(await readFile(propsPath, 'utf8'));
    for (const p of prev) existingSlugs[p.id] = p.slug;
  }

  const fetchedMap = new Map();
  for (const record of publishable) {
    const id = record.fields['Product ID'] != null ? String(record.fields['Product ID']) : null;
    if (!id) continue;
    const photos = record.fields['Photos'] ?? [];
    const nonPhotoFields = { ...record.fields };
    delete nonPhotoFields['Photos'];
    fetchedMap.set(id, {
      content: contentHash(nonPhotoFields),
      photos: photoHash(photos),
      record,
    });
  }

  const hashesOnly = new Map([...fetchedMap].map(([id, v]) => [id, { content: v.content, photos: v.photos }]));
  const { added, updated, unchanged, removed } = diffRecords(hashesOnly, storedHashes);
  console.log(`  added: ${added.length}, updated: ${updated.length}, unchanged: ${unchanged.length}, removed: ${removed.length}`);

  // Phase 3: Photos
  console.log('Phase 3: Syncing photos...');
  const photosBase = join(ROOT, 'assets', 'properties');
  const changed = new Set([...added, ...updated]);

  for (const id of changed) {
    const { record } = fetchedMap.get(id);
    const attachments = record.fields['Photos'] ?? [];
    const destDir = join(photosBase, id);
    await mkdir(destDir, { recursive: true });
    for (let i = 0; i < attachments.length; i++) {
      const destPath = join(destDir, `${i + 1}.jpg`);
      console.log(`  Downloading ${id}/${i + 1}.jpg`);
      await downloadPhoto(attachments[i].url, destPath);
    }
  }

  for (const id of removed) {
    const destDir = join(photosBase, id);
    if (existsSync(destDir)) {
      await rm(destDir, { recursive: true });
      console.log(`  Removed photos for ${id}`);
    }
  }

  // Phase 4: Write (both files written together — all-or-nothing)
  console.log('Phase 4: Writing properties.json and hashes.json...');
  const properties = [];
  const newHashes = { ...storedHashes };

  const skipped = [];
  for (const [id, { content, photos, record }] of fetchedMap) {
    let prop;
    try {
      prop = mapRecord(record, existingSlugs[id]);
    } catch (err) {
      console.warn(`  SKIPPED ${id}: ${err.message}`);
      skipped.push(id);
      continue;
    }
    const attachments = record.fields['Photos'] ?? [];
    prop.photos = attachments.map((_, i) => `/assets/properties/${id}/${i + 1}.jpg`);
    properties.push(prop);
    newHashes[id] = { content, photos };
  }
  if (skipped.length) console.warn(`  Skipped ${skipped.length} invalid records: ${skipped.join(' ')}`);

  for (const id of removed) {
    delete newHashes[id];
  }

  // Sort by id for stable, readable diffs
  properties.sort((a, b) => a.id.localeCompare(b.id));

  await mkdir(dirname(propsPath), { recursive: true });
  await writeFile(propsPath, JSON.stringify(properties, null, 2));
  await mkdir(join(ROOT, 'data'), { recursive: true });
  await writeFile(hashesPath, JSON.stringify(newHashes, null, 2));
  console.log(`  Wrote ${properties.length} properties`);

  // Phase 5: Report
  const changedIds = [...added, ...updated, ...removed];
  const message = changedIds.length === 0
    ? 'sync: no changes'
    : `sync: ${updated.length} updated, ${added.length} added, ${removed.length} removed: ${changedIds.join(' ')}`;

  console.log(message);
  await writeFile(join(ROOT, '.sync-message'), message);
}

main().catch(err => {
  console.error('Sync failed:', err.message);
  process.exit(1);
});
