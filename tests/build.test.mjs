import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

// Run: npm run test:build (builds first, then runs this file)
//
// These checks only verify build *output exists*, not buy-button logic —
// that's unit tested directly in tests/sync.test.mjs against
// scripts/lib/utils.mjs#showBuyButton, independent of whatever real
// properties currently exist in Airtable. Earlier versions of this file
// hardcoded three sample property slugs (LTL-001/002/003) that lived only
// in src/_data/properties.json; a real Airtable sync wiped them out since
// sync.mjs has no mechanism to preserve manually-seeded records, and the
// hardcoded checks kept "passing" only because stale pages from before the
// wipe were still sitting in _site. Asserting against real, currently-synced
// data avoids that trap.

test("_site/index.html exists", () => {
  assert.ok(existsSync("_site/index.html"), "_site/index.html missing");
});

test("_site/properties/index.html exists", () => {
  assert.ok(existsSync("_site/properties/index.html"), "_site/properties/index.html missing");
});

const properties = JSON.parse(readFileSync("src/_data/properties.json", "utf8"));
assert.ok(properties.length > 0, "src/_data/properties.json has no properties to test against");

test("listing page exists for every real property", () => {
  for (const prop of properties) {
    assert.ok(
      existsSync(`_site/property/${prop.slug}/index.html`),
      `_site/property/${prop.slug}/index.html missing`
    );
  }
});

// The real buy button always opens in a new tab to the GeekPay checkout
// (target="_blank" rel="noopener" class="btn-buy"). The mailto fallback CTA
// reuses the same btn-buy visual style but has no target="_blank", so this
// signature is what actually distinguishes "real buy button" from "contact
// fallback that happens to look like a button."
const BUY_BUTTON_SIGNATURE = 'target="_blank" rel="noopener" class="btn-buy"';

test("no property page renders a real buy button without an active geekpay_url", () => {
  for (const prop of properties) {
    const status = (prop.status || "").trim();
    if (prop.geekpay_url && status === "Active") continue;
    const html = readFileSync(`_site/property/${prop.slug}/index.html`, "utf8");
    assert.ok(
      !html.includes(BUY_BUTTON_SIGNATURE),
      `${prop.slug} (status="${status}", geekpay_url=${prop.geekpay_url}) must not render a buy button`
    );
  }
});

// Active listings with no checkout link get a "text us for the payment
// link" line instead of a button. Listings with a link must not show it.
const TEXT_CTA = "To get your payment link, text";

test("Active listings without a geekpay_url show the text-for-link CTA, and others do not", () => {
  for (const prop of properties) {
    const status = (prop.status || "").trim();
    const html = readFileSync(`_site/property/${prop.slug}/index.html`, "utf8");
    const needsTextCta = status === "Active" && !prop.geekpay_url;
    if (needsTextCta) {
      assert.ok(html.includes(TEXT_CTA), `${prop.slug} is Active with no payment link and must show the text CTA`);
      assert.ok(html.includes('href="sms:7069630017'), `${prop.slug} text CTA must link to sms:7069630017`);
    } else {
      assert.ok(!html.includes(TEXT_CTA), `${prop.slug} (status="${status}") must not show the text CTA`);
    }
  }
});

// Internal data-entry notes (e.g. "(per Jeff's site, confirm)") must never
// reach a built page. stripInternalNotes handles it at sync time; this
// guards the output.
test("no listing page contains an internal \"per ...'s site\" note", () => {
  for (const prop of properties) {
    const html = readFileSync(`_site/property/${prop.slug}/index.html`, "utf8");
    assert.ok(!/per [^<)]{0,30}site/i.test(html), `${prop.slug} contains an internal "per ... site" note`);
  }
});

// A source-written description (src/_data/listingBlurbs.json) must render
// on its listing page, but only when its apn matches the record's apn.
const blurbs = JSON.parse(readFileSync("src/_data/listingBlurbs.json", "utf8"));
const escapeHtml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

test("listing blurbs render on matching listings and not on mismatched ones", () => {
  for (const [id, blurb] of Object.entries(blurbs)) {
    if (id.startsWith("_")) continue;
    const prop = properties.find((p) => p.id === id);
    if (!prop) continue; // listing no longer published
    const html = readFileSync(`_site/property/${prop.slug}/index.html`, "utf8");
    const snippet = escapeHtml(blurb.paragraphs[0].slice(0, 60));
    if (blurb.apn === prop.apn) {
      assert.ok(html.includes(snippet), `${prop.slug} must render its source description`);
    } else {
      assert.ok(!html.includes(snippet), `${prop.slug} apn changed (${prop.apn} vs ${blurb.apn}); its source description must not render`);
    }
  }
});

test("_site/sitemap.xml exists", () => {
  assert.ok(existsSync("_site/sitemap.xml"), "_site/sitemap.xml missing");
});

test("_site/robots.txt exists", () => {
  assert.ok(existsSync("_site/robots.txt"), "_site/robots.txt missing");
});

test("_site/404.html exists", () => {
  assert.ok(existsSync("_site/404.html"), "_site/404.html missing");
});
