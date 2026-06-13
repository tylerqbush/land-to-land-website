import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default function () {
  let all;
  try {
    all = JSON.parse(readFileSync(join(__dirname, 'properties.json'), 'utf8'));
  } catch {
    return [];
  }

  const active = all.filter(p => p.status === 'Active');

  // Fisher-Yates shuffle so featured picks rotate each build
  for (let i = active.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [active[i], active[j]] = [active[j], active[i]];
  }

  return active.slice(0, 6);
}
