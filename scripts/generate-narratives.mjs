/**
 * generate-narratives.mjs
 *
 * Reads src/_data/properties.json, calls the Anthropic API for each property
 * that lacks a `narrative` field, and writes back three fields:
 *   - narrative:         HTML string (2-3 <p> tags) targeting one buyer persona
 *   - narrative_bullets: array of { title, description } (3 items)
 *   - buyer_persona:     short label, e.g. "Remote worker seeking off-grid retreat"
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-ant-... node scripts/generate-narratives.mjs
 *
 * Options:
 *   --force   Regenerate narratives even if they already exist
 *   --id=N    Only process property with this ID
 *   --dry-run Print prompts without calling the API
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = join(__dir, '../src/_data/properties.json');
const MODEL = 'claude-haiku-4-5-20251001';
const DELAY_MS = 800; // be polite to the API between calls

const args = process.argv.slice(2);
const force = args.includes('--force');
const dryRun = args.includes('--dry-run');
const onlyId = args.find(a => a.startsWith('--id='))?.split('=')[1];

if (!dryRun && !process.env.ANTHROPIC_API_KEY) {
  console.error('Error: ANTHROPIC_API_KEY environment variable is not set.');
  console.error('Set it before running: export ANTHROPIC_API_KEY=sk-ant-...');
  process.exit(1);
}

function buildPrompt(prop) {
  const fields = [
    `Acreage: ${prop.acreage}`,
    `City: ${prop.city}`,
    `County: ${prop.county}`,
    `State: ${prop.state}`,
    `Terrain: ${prop.terrain || 'Unknown'}`,
    `Elevation: ${prop.elevation || 'Unknown'}`,
    `Zoning: ${prop.zoning || 'Unknown'}`,
    `Flood plain: ${prop.flood_plain || 'Unknown'}`,
    `Road access: ${prop.road_access || 'None'}`,
    `Full-time RV living allowed: ${prop.full_time_rv || 'Unknown'}`,
    `RV living while building: ${prop.rv_while_build || 'Unknown'}`,
    `Manufactured home allowed: ${prop.manufactured_allowed || 'Unknown'}`,
    `Single-family home allowed: ${prop.single_family_allowed || 'Unknown'}`,
    `Tiny home friendly: ${prop.tiny_home_friendly || 'Unknown'}`,
    `Solar viable: ${prop.solar || 'Unknown'}`,
    `Propane available: ${prop.propane || 'Unknown'}`,
    `Septic: ${prop.septic || 'Unknown'}`,
    `Monthly payment: $${prop.monthly}/mo`,
    `Down payment: ${prop.down ? '$' + prop.down : 'Unknown'}`,
    `Term: ${prop.term_months ? prop.term_months + ' months' : 'Unknown'}`,
  ].join('\n');

  return `You are writing copy for a land investing company. Your job is to write a compelling, buyer-specific narrative for a vacant land listing. The copy must be honest, direct, and grounded in the actual property data provided. No corporate filler. No em dashes. No exclamation points. Plain, confident voice.

PROPERTY DATA:
${fields}

EXISTING DESCRIPTION: ${prop.description || 'None'}

RULES:
1. Identify ONE specific buyer persona this property is best suited for based on the data. Examples: "Remote worker seeking a simple off-grid base," "Retiree wanting affordable land to park an RV," "First-time land buyer starting small in the Southwest." Be specific.
2. Write 2 short paragraphs (HTML <p> tags) speaking directly to that one buyer. Lead with what makes this property right for them. Be specific about the property's actual attributes. Do not invent facts not in the data.
3. Write 3 feature bullets. Each bullet has a short title and a 1-sentence description grounded in the data.
4. Do not mention animals, wildlife, hunting, or fishing in the narrative or bullets.
5. The narrative should feel like a knowledgeable friend telling someone about a property, not a sales pitch.
6. CRITICAL — ownership and use accuracy: The buyer does NOT own this land and does NOT have possession rights until the note is paid in full. The seller retains legal title throughout the payment term. The deed only transfers upon full payoff. Never say the buyer "can move in," "owns," "has possession," or imply they can take any action on the property as a right of purchase. Fields like "Full-time RV living allowed: Yes" mean the county/zoning permits that use on this type of land — they say nothing about what the buyer is entitled to do before payoff. Write only about what the land permits or is suited for, not what the buyer can do immediately. Example: say "the county permits full-time RV living on this parcel" not "you can move your RV on" or "you can start building right away."

Respond ONLY with a JSON object in this exact shape (no markdown, no code fences):
{
  "buyer_persona": "string — short label for the target buyer",
  "narrative": "string — two <p> tags of HTML prose",
  "narrative_bullets": [
    { "title": "string", "description": "string" },
    { "title": "string", "description": "string" },
    { "title": "string", "description": "string" }
  ]
}`;
}

async function callAnthropic(prompt) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text?.trim();
  if (!text) throw new Error('Empty response from API');

  try {
    return JSON.parse(text);
  } catch {
    // Try to extract JSON from the text if it has extra content
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error(`Could not parse JSON from response: ${text.slice(0, 200)}`);
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const properties = JSON.parse(readFileSync(DATA_PATH, 'utf8'));

  const toProcess = properties.filter(p => {
    if (onlyId && p.id !== onlyId) return false;
    if (force) return true;
    return !p.narrative;
  });

  console.log(`Properties to process: ${toProcess.length} of ${properties.length} total`);
  if (toProcess.length === 0) {
    console.log('Nothing to do. Use --force to regenerate existing narratives.');
    return;
  }

  let updated = 0;
  let failed = 0;

  for (const prop of toProcess) {
    const label = `[${prop.id}] ${prop.acreage}ac ${prop.city}, ${prop.state}`;
    const prompt = buildPrompt(prop);

    if (dryRun) {
      console.log(`\n${'='.repeat(60)}\n${label}\n${'='.repeat(60)}`);
      console.log(prompt);
      continue;
    }

    process.stdout.write(`${label} ... `);

    try {
      const result = await callAnthropic(prompt);

      // Validate shape
      if (!result.buyer_persona || !result.narrative || !Array.isArray(result.narrative_bullets)) {
        throw new Error('Response missing required fields');
      }

      const idx = properties.findIndex(p => p.id === prop.id);
      properties[idx].buyer_persona = result.buyer_persona;
      properties[idx].narrative = result.narrative;
      properties[idx].narrative_bullets = result.narrative_bullets;

      console.log(`done (${result.buyer_persona})`);
      updated++;
    } catch (err) {
      console.log(`FAILED: ${err.message}`);
      failed++;
    }

    if (toProcess.indexOf(prop) < toProcess.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  if (!dryRun) {
    writeFileSync(DATA_PATH, JSON.stringify(properties, null, 2));
    console.log(`\nDone. Updated: ${updated}, Failed: ${failed}`);
    console.log(`Saved to ${DATA_PATH}`);
    if (failed > 0) {
      console.log('Re-run to retry failed properties (they have no narrative field).');
    }
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
