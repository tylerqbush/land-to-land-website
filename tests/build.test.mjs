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

// ── Phase 1 property page ────────────────────────────────────────────────
const page = (prop) => readFileSync(`_site/property/${prop.slug}/index.html`, "utf8");
const fitData = JSON.parse(readFileSync("src/_data/listingFit.json", "utf8"));
const countyPlanning = JSON.parse(readFileSync("src/_data/countyPlanning.json", "utf8"));

test("every listing page has a heading, its own browser-tab title, and a meta description", () => {
  for (const prop of properties) {
    const html = page(prop);
    const h1 = (html.match(/<h1 class="listing-hero__title">([^<]*)<\/h1>/) || [])[1];
    assert.ok(h1 && h1.trim(), `${prop.slug}: heading is empty`);
    const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || "";
    assert.ok(title.includes("Land to Land Holdings") && title.startsWith(prop.name.slice(0, 10)), `${prop.slug}: <title> is generic or missing the listing name ("${title}")`);
    const meta = (html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || "";
    assert.ok(meta.length > 40 && !meta.startsWith("Buy vacant land with no bank"), `${prop.slug}: meta description is generic or empty`);
  }
});

test("sticky text bar: Active listings only, with an sms link to Tyler", () => {
  for (const prop of properties) {
    const html = page(prop);
    if ((prop.status || "").trim() === "Active") {
      assert.ok(html.includes('class="sticky-cta"'), `${prop.slug}: Active listing needs the sticky bar`);
      assert.ok(/class="sticky-cta">\s*<a href="sms:7069630017/.test(html), `${prop.slug}: sticky bar must link to sms:7069630017`);
    } else {
      assert.ok(!html.includes('class="sticky-cta"'), `${prop.slug} (${prop.status}) must not show the sticky bar`);
    }
  }
});

test('"To start today" shows down payment plus doc fee on listings still for sale, never on Sold', () => {
  for (const prop of properties) {
    const html = page(prop);
    const sold = (prop.status || "").trim() === "Sold";
    const expect = !sold && prop.down != null && prop.doc_fee != null;
    assert.equal(html.includes("To start today"), expect, `${prop.slug}: "To start today" expected=${expect}`);
    if (expect) {
      const total = (Math.round((prop.down + prop.doc_fee) * 100) / 100).toLocaleString("en-US");
      assert.ok(html.includes(`$${total}</td>`), `${prop.slug}: should show $${total} to start`);
    }
  }
});

test("fit boxes render only for Active listings whose apn matches the entry", () => {
  for (const prop of properties) {
    const html = page(prop);
    const entry = fitData[prop.id];
    const active = (prop.status || "").trim() === "Active";
    const expected = Boolean(entry && entry.apn === prop.apn && active);
    assert.equal(html.includes("fit-card--good"), expected, `${prop.slug}: fit boxes expected=${expected}`);
  }
});

// Whole dollars as "150", otherwise two decimals as "162.77" (matches the
// money filter in .eleventy.js).
const money = (n) => Number.isInteger(n)
  ? n.toLocaleString("en-US")
  : n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

test("monthly bill: breakdown on listings for sale, a total only when fee and tax are both on file, never on Sold", () => {
  for (const prop of properties) {
    const html = page(prop);
    const sold = (prop.status || "").trim() === "Sold";
    if (sold || prop.monthly == null) {
      assert.ok(!html.includes("Your monthly bill"), `${prop.slug}: must not show a monthly bill`);
      continue;
    }
    assert.ok(html.includes("Your monthly bill"), `${prop.slug}: should show a monthly bill`);
    const complete = prop.note_fee != null && prop.annual_taxes != null;
    assert.equal(html.includes("Billed monthly"), complete, `${prop.slug}: total only when fee and tax are known`);
    if (complete) {
      const tax = Math.round((prop.annual_taxes / 12) * 100) / 100;
      const total = Math.round((prop.monthly + prop.note_fee + tax) * 100) / 100;
      assert.ok(html.includes(`$${money(total)}</td>`), `${prop.slug}: should bill $${money(total)} monthly`);
    }
  }
});

test("county rules table shows on listings still for sale, with a verified county contact when we have one", () => {
  for (const prop of properties) {
    const html = page(prop);
    const forSale = ["Active", "Under Contract"].includes((prop.status || "").trim());
    assert.equal(html.includes("What the county allows here"), forSale, `${prop.slug}: county table expected=${forSale}`);
    const county = countyPlanning[`${prop.county}|${prop.state}`];
    if (forSale && county) {
      assert.ok(html.includes(`href="tel:${county.tel}"`), `${prop.slug}: should link the ${county.name} number`);
    }
  }
});

test("county market copy only shows on listings in that county", () => {
  for (const prop of properties) {
    const named = (page(prop).match(/Why Buyers Choose ([A-Za-z ]+?) County/) || [])[1];
    if (named) assert.equal(named, prop.county, `${prop.slug} shows ${named} County copy but is in ${prop.county} County`);
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

// ── Phase 2 trust pages ──────────────────────────────────────────────────
const TRUST_PAGES = ["30-day-promise", "using-your-land", "faq"];

test("trust pages exist, have no em dashes, and are linked from the footer", () => {
  const home = readFileSync("_site/index.html", "utf8");
  for (const slug of TRUST_PAGES) {
    assert.ok(existsSync(`_site/${slug}/index.html`), `${slug} page missing`);
    const html = readFileSync(`_site/${slug}/index.html`, "utf8");
    assert.ok(!html.includes("—"), `${slug} contains an em dash`);
    assert.ok(home.includes(`href="/${slug}/"`), `footer must link /${slug}/`);
  }
});

test("30-day promise page states the decided terms", () => {
  const html = readFileSync("_site/30-day-promise/index.html", "utf8");
  for (const phrase of ["down payment", "monthly payment", "document fee", "service fees", "date of your down payment", "Cash sales are final", "current on your payments", "original payment method"]) {
    assert.ok(html.toLowerCase().includes(phrase.toLowerCase()), `promise page missing: ${phrase}`);
  }
});

test("homepage and About no longer overstate the promise", () => {
  const home = readFileSync("_site/index.html", "utf8");
  const about = readFileSync("_site/about/index.html", "utf8");
  assert.ok(!home.includes("No fee, no argument"), "homepage still says no fee");
  assert.ok(!about.includes("No hidden fees"), "About still says no hidden fees");
  assert.ok(home.includes("/30-day-promise/") && about.includes("/30-day-promise/"), "both should link the promise page");
});

test("FAQ internal links resolve to built pages", () => {
  const full = readFileSync("_site/faq/index.html", "utf8");
  const start = full.indexOf('class="faq-list"');
  const html = full.slice(start, full.indexOf("</section>", start));
  assert.ok(html.length > 200, "could not isolate the FAQ content");
  for (const [, href] of html.matchAll(/href="(\/[^"#?]*)"/g)) {
    if (href.startsWith("/assets/")) { assert.ok(existsSync(`_site${href}`), `${href} missing`); continue; }
    assert.ok(existsSync(`_site${href}index.html`) || existsSync(`_site${href}`), `${href} does not resolve`);
  }
});

// ── Phase 3 state pages + early access ───────────────────────────────────
const STATE_PAGES = { FL: "florida", AZ: "arizona", OR: "oregon", NM: "new-mexico" };

test("each state page lists exactly that state's Active listings and no one else's", () => {
  for (const [abbr, slug] of Object.entries(STATE_PAGES)) {
    const path = `_site/land/${slug}/index.html`;
    assert.ok(existsSync(path), `${path} missing`);
    const html = readFileSync(path, "utf8");
    assert.ok(!html.includes("—"), `${slug} has an em dash`);
    for (const prop of properties) {
      const shown = html.includes(`href="/property/${prop.slug}/"`);
      const expected = prop.state === abbr && (prop.status || "").trim() === "Active";
      assert.equal(shown, expected, `${slug}: ${prop.slug} shown=${shown} expected=${expected}`);
    }
  }
});

test("state page market copy only shows when a listing is in that copy's county", () => {
  for (const slug of Object.values(STATE_PAGES)) {
    const html = readFileSync(`_site/land/${slug}/index.html`, "utf8");
    const named = (html.match(/Why Buyers Choose ([A-Za-z ]+?) County/) || [])[1];
    if (!named) continue;
    const stateProps = properties.filter((p) => STATE_PAGES[p.state] === slug && (p.status || "").trim() === "Active");
    assert.ok(stateProps.some((p) => p.county === named), `${slug} shows ${named} County copy with no active listing there`);
  }
});

test("early access page embeds the form and is linked from the footer and state pages", () => {
  const html = readFileSync("_site/early-access/index.html", "utf8");
  assert.ok(html.includes("link.acrematic.com/widget/form/"), "form embed missing");
  assert.ok(!html.includes("—"), "early-access has an em dash");
  assert.ok(readFileSync("_site/index.html", "utf8").includes('href="/early-access/"'), "footer link missing");
  for (const slug of Object.values(STATE_PAGES)) {
    assert.ok(readFileSync(`_site/land/${slug}/index.html`, "utf8").includes('href="/early-access/"'), `${slug} must link early access`);
  }
});
