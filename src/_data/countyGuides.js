// One guide page per county in countyPlanning.json (/county/<county>-<st>/).
// Everything shown is derived from synced listings or from data files we
// already verified (planning contact, market copy). Nothing is researched or
// invented here. A county with no Active listing keeps its page.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const read = (f) => JSON.parse(readFileSync(join(dir, f), 'utf8'));

const STATE_NAMES = { FL: 'Florida', AZ: 'Arizona', OR: 'Oregon', NM: 'New Mexico' };
const STATE_SLUGS = { FL: 'florida', AZ: 'arizona', OR: 'oregon', NM: 'new-mexico' };
const range = (nums) => (nums.length ? { min: Math.min(...nums), max: Math.max(...nums) } : null);

export default function () {
  const properties = read('properties.json');
  const planning = read('countyPlanning.json');

  return Object.keys(planning)
    .filter((k) => !k.startsWith('_'))
    .map((key) => {
      const [county, abbr] = key.split('|');
      const active = properties.filter((p) => p.county === county && p.state === abbr && (p.status || '').trim() === 'Active');
      return {
        key,
        county,
        abbr,
        state: STATE_NAMES[abbr] || abbr,
        stateSlug: STATE_SLUGS[abbr] || null,
        slug: `${county.toLowerCase().replace(/\s+/g, '-')}-${abbr.toLowerCase()}`,
        planning: planning[key],
        activeCount: active.length,
        acreage: range(active.map((p) => Number(p.acreage)).filter(Number.isFinite)),
        monthly: range(active.map((p) => Number(p.monthly)).filter(Number.isFinite)),
      };
    });
}
