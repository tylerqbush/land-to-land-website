import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  slugify,
  generateSlug,
  parseAcreage,
  parseGPS,
  normalizeStatus,
  isPublishable,
  showBuyButton,
  contentHash,
  photoHash,
  normalizeGeekpay,
  diffRecords,
} from '../scripts/lib/utils.mjs';

// ── slugify ──────────────────────────────────────────────
test('slugify: lowercases and replaces spaces', () => {
  assert.equal(slugify('Putnam County'), 'putnam-county');
});
test('slugify: collapses multiple non-alphanumeric chars to one hyphen', () => {
  assert.equal(slugify('Klamath  Falls!!'), 'klamath-falls');
});
test('slugify: strips leading and trailing hyphens', () => {
  assert.equal(slugify('  luna  '), 'luna');
});

// ── generateSlug ─────────────────────────────────────────
test('generateSlug: produces correct format', () => {
  assert.equal(
    generateSlug(5, 'Satsuma', 'Putnam', 'FL', 'LTL-001'),
    '5-acre-satsuma-putnam-fl-ltl-001'
  );
});
test('generateSlug: handles decimal acreage', () => {
  assert.equal(
    generateSlug(2.5, 'Deming', 'Luna', 'NM', 'LTL-002'),
    '2.5-acre-deming-luna-nm-ltl-002'
  );
});

// ── parseAcreage ─────────────────────────────────────────
test('parseAcreage: parses plain number string', () => {
  assert.equal(parseAcreage('5'), 5);
});
test('parseAcreage: parses "5 acres"', () => {
  assert.equal(parseAcreage('5 acres'), 5);
});
test('parseAcreage: parses decimal', () => {
  assert.equal(parseAcreage('2.5'), 2.5);
});
test('parseAcreage: returns null for empty string', () => {
  assert.equal(parseAcreage(''), null);
});

// ── parseGPS ─────────────────────────────────────────────
test('parseGPS: splits "lat, lng" into floats', () => {
  assert.deepEqual(parseGPS('29.65, -81.51'), { lat: 29.65, lng: -81.51 });
});
test('parseGPS: handles no spaces', () => {
  assert.deepEqual(parseGPS('32.27,-107.75'), { lat: 32.27, lng: -107.75 });
});
test('parseGPS: returns nulls for empty string', () => {
  assert.deepEqual(parseGPS(''), { lat: null, lng: null });
});
test('parseGPS: returns nulls for null', () => {
  assert.deepEqual(parseGPS(null), { lat: null, lng: null });
});

// ── normalizeStatus ───────────────────────────────────────
test('normalizeStatus: trims trailing space (Airtable quirk)', () => {
  assert.equal(normalizeStatus('Active '), 'Active');
});
test('normalizeStatus: trims both ends', () => {
  assert.equal(normalizeStatus('  Under Contract  '), 'Under Contract');
});

// ── isPublishable ─────────────────────────────────────────
test('isPublishable: Active passes', () => {
  assert.ok(isPublishable('Active'));
});
test('isPublishable: Active with trailing space passes', () => {
  assert.ok(isPublishable('Active '));
});
test('isPublishable: Under Contract passes', () => {
  assert.ok(isPublishable('Under Contract'));
});
test('isPublishable: Sold passes', () => {
  assert.ok(isPublishable('Sold'));
});
test('isPublishable: Due Diligence is rejected', () => {
  assert.ok(!isPublishable('Due Diligence'));
});
test('isPublishable: Acquisition Closing with trailing space is rejected', () => {
  assert.ok(!isPublishable('Acquisition Closing '));
});

// ── showBuyButton ─────────────────────────────────────────
test('showBuyButton: Active with geekpay_url shows the button', () => {
  assert.ok(showBuyButton({ status: 'Active', geekpay_url: 'https://checkout.geekpay.com/x' }));
});
test('showBuyButton: Active with trailing-space status and geekpay_url shows the button', () => {
  assert.ok(showBuyButton({ status: 'Active ', geekpay_url: 'https://checkout.geekpay.com/x' }));
});
test('showBuyButton: Active with no geekpay_url does not show the button', () => {
  assert.ok(!showBuyButton({ status: 'Active', geekpay_url: null }));
});
test('showBuyButton: Under Contract with geekpay_url does not show the button', () => {
  assert.ok(!showBuyButton({ status: 'Under Contract', geekpay_url: 'https://checkout.geekpay.com/x' }));
});
test('showBuyButton: Sold with geekpay_url does not show the button', () => {
  assert.ok(!showBuyButton({ status: 'Sold', geekpay_url: 'https://checkout.geekpay.com/x' }));
});
test('showBuyButton: missing status does not show the button', () => {
  assert.ok(!showBuyButton({ geekpay_url: 'https://checkout.geekpay.com/x' }));
});

// ── contentHash ───────────────────────────────────────────
test('contentHash: same input in different key order produces same hash', () => {
  assert.equal(contentHash({ a: 1, b: 2 }), contentHash({ b: 2, a: 1 }));
});
test('contentHash: different values produce different hash', () => {
  assert.notEqual(contentHash({ a: 1 }), contentHash({ a: 2 }));
});

// ── photoHash ────────────────────────────────────────────
test('photoHash: joins attachment ids with comma', () => {
  assert.equal(
    photoHash([{ id: 'att1', url: 'x' }, { id: 'att2', url: 'y' }]),
    'att1,att2'
  );
});
test('photoHash: uses id not url (url rotates, id is stable)', () => {
  const h1 = photoHash([{ id: 'att1', url: 'http://old.url' }]);
  const h2 = photoHash([{ id: 'att1', url: 'http://new.url' }]);
  assert.equal(h1, h2);
});
test('photoHash: empty array returns empty string', () => {
  assert.equal(photoHash([]), '');
});
test('photoHash: undefined returns empty string', () => {
  assert.equal(photoHash(undefined), '');
});

// ── normalizeGeekpay ─────────────────────────────────────
test('normalizeGeekpay: returns null for null', () => {
  assert.equal(normalizeGeekpay(null), null);
});
test('normalizeGeekpay: returns null for empty string', () => {
  assert.equal(normalizeGeekpay(''), null);
});
test('normalizeGeekpay: returns null for whitespace-only string', () => {
  assert.equal(normalizeGeekpay('   '), null);
});
test('normalizeGeekpay: returns url for valid url', () => {
  assert.equal(
    normalizeGeekpay('https://checkout.geekpay.com/abc'),
    'https://checkout.geekpay.com/abc'
  );
});
test('normalizeGeekpay: trims whitespace from valid url', () => {
  assert.equal(
    normalizeGeekpay('  https://checkout.geekpay.com/abc  '),
    'https://checkout.geekpay.com/abc'
  );
});

// ── diffRecords ───────────────────────────────────────────
test('diffRecords: new record not in stored hashes → added', () => {
  const fetched = new Map([['LTL-004', { content: 'abc', photos: '' }]]);
  const { added } = diffRecords(fetched, {});
  assert.deepEqual(added, ['LTL-004']);
});
test('diffRecords: same content and photo hash → unchanged', () => {
  const fetched = new Map([['LTL-001', { content: 'abc', photos: 'att1' }]]);
  const stored = { 'LTL-001': { content: 'abc', photos: 'att1' } };
  const { unchanged } = diffRecords(fetched, stored);
  assert.deepEqual(unchanged, ['LTL-001']);
});
test('diffRecords: content hash changed → updated', () => {
  const fetched = new Map([['LTL-001', { content: 'newHash', photos: '' }]]);
  const stored = { 'LTL-001': { content: 'oldHash', photos: '' } };
  const { updated } = diffRecords(fetched, stored);
  assert.deepEqual(updated, ['LTL-001']);
});
test('diffRecords: photo hash changed → updated', () => {
  const fetched = new Map([['LTL-001', { content: 'same', photos: 'att2' }]]);
  const stored = { 'LTL-001': { content: 'same', photos: 'att1' } };
  const { updated } = diffRecords(fetched, stored);
  assert.deepEqual(updated, ['LTL-001']);
});
test('diffRecords: id in stored but not in fetch → removed', () => {
  const fetched = new Map();
  const stored = { 'LTL-001': { content: 'abc', photos: '' } };
  const { removed } = diffRecords(fetched, stored);
  assert.deepEqual(removed, ['LTL-001']);
});
