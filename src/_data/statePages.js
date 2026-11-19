// One landing page per state we sell in (/land/<slug>/). Built from the
// synced properties so counts and counties never go stale. A state with no
// Active listings still gets its page (with a signup prompt) so links never 404.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const read = (f) => JSON.parse(readFileSync(join(dir, f), 'utf8'));

const STATES = [
  { abbr: 'FL', name: 'Florida', slug: 'florida' },
  { abbr: 'AZ', name: 'Arizona', slug: 'arizona' },
  { abbr: 'OR', name: 'Oregon', slug: 'oregon' },
  { abbr: 'NM', name: 'New Mexico', slug: 'new-mexico' },
];

export default function () {
  const properties = read('properties.json');
  const planning = read('countyPlanning.json');

  return STATES.map((s) => {
    const active = properties.filter((p) => p.state === s.abbr && (p.status || '').trim() === 'Active');
    const counties = [...new Set(active.map((p) => p.county))].sort().map((county) => ({
      county,
      count: active.filter((p) => p.county === county).length,
      planning: planning[`${county}|${s.abbr}`] || null,
    }));
    return { ...s, activeCount: active.length, counties };
  });
}
