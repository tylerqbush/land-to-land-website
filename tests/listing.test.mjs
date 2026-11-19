import { test } from 'node:test';
import assert from 'node:assert/strict';
import { costToStart, classifyUse, allowedUses, similarParcels } from '../scripts/lib/utils.mjs';

// ── costToStart ──────────────────────────────────────────
test('costToStart: down payment plus doc fee', () => {
  assert.deepEqual(costToStart({ down: 247, doc_fee: 247 }), { down: 247, docFee: 247, total: 494 });
});
test('costToStart: a $0 down payment is a real number, not missing', () => {
  assert.equal(costToStart({ down: 0, doc_fee: 249 }).total, 249);
});
test('costToStart: null when either piece is missing', () => {
  assert.equal(costToStart({ down: 247, doc_fee: null }), null);
  assert.equal(costToStart({ down: null, doc_fee: 247 }), null);
  assert.equal(costToStart({}), null);
  assert.equal(costToStart(null), null);
});
test('costToStart: null for non-numeric or negative values', () => {
  assert.equal(costToStart({ down: 'abc', doc_fee: 100 }), null);
  assert.equal(costToStart({ down: -5, doc_fee: 100 }), null);
});
test('costToStart: no floating-point drift on cents', () => {
  assert.equal(costToStart({ down: 0.1, doc_fee: 0.2 }).total, 0.3);
});

// ── classifyUse: real values from Airtable ───────────────
test('classifyUse: plain yes and no', () => {
  assert.deepEqual(classifyUse('Yes'), { status: 'yes', note: '' });
  assert.deepEqual(classifyUse('yes'), { status: 'yes', note: '' });
  assert.deepEqual(classifyUse('No'), { status: 'no', note: '' });
});
test('classifyUse: yes with limits keeps the original wording as the note', () => {
  assert.deepEqual(classifyUse('Yes, up to 21 days in each 6-month period.'),
    { status: 'limits', note: 'Up to 21 days in each 6-month period.' });
  assert.deepEqual(classifyUse('Yes, manufactured after June 15, 1976'),
    { status: 'limits', note: 'Manufactured after June 15, 1976.' });
  assert.equal(classifyUse('Yes, Allowed for up to 21 days in each 6 month period').status, 'limits');
});
test('classifyUse: yes with a plain remark is still just allowed', () => {
  assert.deepEqual(classifyUse('Yes (raised home recommended, flood zone)'),
    { status: 'yes', note: 'Raised home recommended, flood zone.' });
});
test('classifyUse: leading limit phrases', () => {
  assert.equal(classifyUse('Only with Temporary Residence Permit (1 yr, renewable, septic required)').status, 'limits');
  assert.equal(classifyUse('Limited to 21 days in a 6 month period').status, 'limits');
  assert.equal(classifyUse('Allowed for up to 21 days in each 6 month period').status, 'limits');
  assert.equal(classifyUse('Up to 2 weeks at a time, max 30 days/year unless Temporary Residence Permit').status, 'limits');
  assert.equal(classifyUse('Must meet residential building code with foundation').status, 'limits');
});
test('classifyUse: "required" is a fact about the parcel, not a limit', () => {
  assert.deepEqual(classifyUse('Yes. Septic required.'), { status: 'yes', note: 'Septic required.' });
  assert.deepEqual(classifyUse('Yes, required per county planner.'), { status: 'yes', note: 'Required per county planner.' });
  assert.deepEqual(classifyUse('Y - would have to install a septic system'), { status: 'yes', note: 'Would have to install a septic system.' });
});
test('classifyUse: blank, N/A, and unknown become "ask"', () => {
  assert.deepEqual(classifyUse(''), { status: 'ask', note: '' });
  assert.deepEqual(classifyUse('N/A'), { status: 'ask', note: '' });
  assert.deepEqual(classifyUse(undefined), { status: 'ask', note: '' });
  assert.deepEqual(classifyUse('Unknown'), { status: 'ask', note: '' });
});
test('classifyUse: ambiguous text is shown as written, with no status guessed', () => {
  const t = 'Per County, Oregon ordinance code needed to be follow. Must have to submit a plan to review to confirm anything.';
  assert.deepEqual(classifyUse(t), { status: 'info', note: t });
  assert.equal(classifyUse('One Single Family of Manufactured home').status, 'info');
});
test('classifyUse: "No" must not match words that merely start with N', () => {
  assert.equal(classifyUse('Nothing on file').status, 'info');
  assert.equal(classifyUse('Not allowed').status, 'no');
});

// ── allowedUses ──────────────────────────────────────────
const AZ = {
  single_family_allowed: 'Yes', manufactured_allowed: 'Yes, manufactured after June 15, 1976',
  tiny_home_friendly: 'Must meet residential building code with foundation', tent_camping: 'No',
  camping_rv: 'Yes, up to 2 weeks at a time, max 30 days/year', septic: 'Yes. Septic required.',
  electricity: 'No. Solar, wind, or generator (Mohave Electric Co-Op 928-763-1100)', flood_plain: 'No',
};
test('allowedUses: groups rows and reports that there are answers', () => {
  const u = allowedUses(AZ);
  assert.equal(u.hasAnswers, true);
  assert.deepEqual(u.groups.map(g => g.title), ['Homes and building', 'Camping and RVs', 'Utilities and land']);
  const find = (label) => u.groups.flatMap(g => g.rows).find(r => r.label === label);
  assert.equal(find('Single-family home').chip, 'Allowed');
  assert.equal(find('Tent camping').chip, 'Not allowed');
  assert.equal(find('RV camping').chip, 'Allowed, with limits');
  assert.equal(find('Flood zone').note, 'Not in a flood zone.');
  assert.equal(find('Power at the lot').chip, '');
});
test('allowedUses: optional rows are hidden when blank, core rows say "Ask the county"', () => {
  const u = allowedUses({ single_family_allowed: 'Yes' });
  const rows = u.groups.flatMap(g => g.rows);
  assert.ok(!rows.find(r => r.label === 'Modular home'), 'modular is optional');
  assert.ok(!rows.find(r => r.label === 'Hunting'), 'hunting is optional');
  assert.equal(rows.find(r => r.label === 'Tiny home').chip, 'Ask the county');
});
test('allowedUses: a listing with no use data reports no answers', () => {
  assert.equal(allowedUses({ zoning: 'R-2 Residential' }).hasAnswers, false);
  assert.equal(allowedUses({}).hasAnswers, false);
});
test('allowedUses: hunting shows when Airtable has a value', () => {
  const u = allowedUses({ hunting: 'Yes' });
  assert.equal(u.groups.flatMap(g => g.rows).find(r => r.label === 'Hunting').chip, 'Allowed');
});

// ── listingName ──────────────────────────────────────────
import { listingName } from '../scripts/lib/utils.mjs';
test("listingName: keeps Airtable's name when it has one", () => {
  assert.equal(listingName('2.4 acre property in Klamath, OR (APN 7135)', 2.4, 'Chiloquin', 'OR'), '2.4 acre property in Klamath, OR (APN 7135)');
});
test('listingName: builds a plain name when Airtable returns blank', () => {
  assert.equal(listingName('', 3, 'Deming', 'NM'), '3 acre property in Deming, NM');
  assert.equal(listingName(undefined, 0.23, 'Georgetown', 'FL'), '0.23 acre property in Georgetown, FL');
  assert.equal(listingName('   ', 2.5, 'Chiloquin', 'OR'), '2.5 acre property in Chiloquin, OR');
});
test('listingName: copes with missing acreage or location', () => {
  assert.equal(listingName('', null, 'Deming', 'NM'), 'Property in Deming, NM');
  assert.equal(listingName('', 3, '', ''), '3 acre property');
});

// ── monthlyBill ──────────────────────────────────────────
import { monthlyBill } from '../scripts/lib/utils.mjs';
test('monthlyBill: payment + service fee + property tax share', () => {
  assert.deepEqual(monthlyBill({ monthly: 150, note_fee: 10, annual_taxes: 33.18 }),
    { payment: 150, serviceFee: 10, taxShare: 2.77, total: 162.77 });
});
test('monthlyBill: whole-dollar taxes divide cleanly', () => {
  assert.equal(monthlyBill({ monthly: 199, note_fee: 10, annual_taxes: 28 }).taxShare, 2.33);
  assert.equal(monthlyBill({ monthly: 247, note_fee: 5, annual_taxes: 72 }).total, 258);
});
test('monthlyBill: no total unless every piece is known', () => {
  assert.equal(monthlyBill({ monthly: 158.75, note_fee: null, annual_taxes: 41.96 }).total, null);
  assert.equal(monthlyBill({ monthly: 165, note_fee: 10, annual_taxes: null }).total, null);
  assert.equal(monthlyBill({ monthly: 165, note_fee: 10, annual_taxes: null }).serviceFee, 10);
});
test('monthlyBill: null when there is no monthly payment', () => {
  assert.equal(monthlyBill({}), null);
  assert.equal(monthlyBill(null), null);
  assert.equal(monthlyBill({ monthly: 'abc' }), null);
});
test('monthlyBill: a $0 service fee or tax is a real value, not missing', () => {
  assert.equal(monthlyBill({ monthly: 100, note_fee: 0, annual_taxes: 0 }).total, 100);
});

// ── similarParcels ───────────────────────────────────────
const L = (id, county, state, acreage, status = 'Active') => ({ id, county, state, acreage, status });
test('similarParcels: same county beats a closer-sized listing elsewhere', () => {
  const me = L('1', 'Putnam', 'FL', 0.25);
  const all = [me, L('2', 'Luna', 'NM', 0.25), L('3', 'Putnam', 'FL', 5)];
  assert.deepEqual(similarParcels(me, all).map((p) => p.id), ['3', '2']);
});
test('similarParcels: same state comes before other states, then closest acreage', () => {
  const me = L('1', 'Mohave', 'AZ', 2.2);
  const all = [me, L('2', 'Apache', 'AZ', 9), L('3', 'Klamath', 'OR', 2.2), L('4', 'Apache', 'AZ', 3)];
  assert.deepEqual(similarParcels(me, all).map((p) => p.id), ['4', '2', '3']);
});
test('similarParcels: never itself, never Sold or Under Contract, trailing-space status ok, limit respected', () => {
  const me = L('1', 'A', 'FL', 1);
  const all = [me, L('2', 'A', 'FL', 1, 'Sold'), L('3', 'A', 'FL', 1, 'Under Contract '), L('4', 'A', 'FL', 1, 'Active '), L('5', 'A', 'FL', 2), L('6', 'A', 'FL', 3), L('7', 'A', 'FL', 4)];
  assert.deepEqual(similarParcels(me, all, 3).map((p) => p.id), ['4', '5', '6']);
});
test('similarParcels: empty when there is nothing else to suggest', () => {
  const me = L('1', 'A', 'FL', 1);
  assert.deepEqual(similarParcels(me, [me]), []);
  assert.deepEqual(similarParcels(null, []), []);
});
