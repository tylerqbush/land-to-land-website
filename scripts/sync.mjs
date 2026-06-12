import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
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
      filterByFormula: '{Ready for Website}=TRUE',
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

async function main() {
  const pat = process.env.AIRTABLE_PAT;
  if (!pat) throw new Error('AIRTABLE_PAT environment variable is not set');

  // Phase 1: Fetch
  console.log('Phase 1: Fetching from Airtable...');
  const raw = await fetchAllRecords(pat);
  const publishable = raw.filter(r => isPublishable(r.fields['Status'] ?? ''));
  console.log(`  Fetched ${raw.length} records, ${publishable.length} publishable`);
}

main().catch(err => {
  console.error('Sync failed:', err.message);
  process.exit(1);
});
