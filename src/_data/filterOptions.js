import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Drives the state/county dropdowns on the Browse Properties filter bar.
// Derived from whatever states/counties actually exist in
// properties.json instead of a hardcoded list, so a new market (a new
// state or county showing up via Airtable sync) never silently has no
// filter option, the way Arizona did after a hardcoded list went stale.
export default function () {
  let all;
  try {
    all = JSON.parse(readFileSync(join(__dirname, 'properties.json'), 'utf8'));
  } catch {
    return { states: [], counties: [] };
  }

  const states = [...new Set(all.map(p => p.state).filter(Boolean))].sort();

  const countyMap = new Map();
  for (const p of all) {
    if (!p.county || !p.state) continue;
    const key = `${p.county}|${p.state}`;
    if (!countyMap.has(key)) countyMap.set(key, { county: p.county, state: p.state });
  }
  const counties = [...countyMap.values()].sort((a, b) => a.county.localeCompare(b.county));

  return { states, counties };
}
