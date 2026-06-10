import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

// Run: npm run test:build (builds first, then runs this file)

test("_site/index.html exists", () => {
  assert.ok(existsSync("_site/index.html"), "_site/index.html missing");
});

test("_site/properties/index.html exists", () => {
  assert.ok(existsSync("_site/properties/index.html"), "_site/properties/index.html missing");
});

const slugs = [
  "5-acre-satsuma-putnam-fl-ltl-001",
  "10-acre-deming-luna-nm-ltl-002",
  "2-acre-klamath-falls-klamath-or-ltl-003",
];

for (const slug of slugs) {
  test(`listing page exists for ${slug}`, () => {
    assert.ok(
      existsSync(`_site/property/${slug}/index.html`),
      `_site/property/${slug}/index.html missing`
    );
  });
}

test("LTL-002 (Under Contract, null geekpay_url) has no buy button", () => {
  const html = readFileSync(
    "_site/property/10-acre-deming-luna-nm-ltl-002/index.html",
    "utf8"
  );
  assert.ok(!html.includes('class="btn-buy"'), "LTL-002 must not render a buy button");
});

test("LTL-001 (Active, has geekpay_url) renders a buy button", () => {
  const html = readFileSync(
    "_site/property/5-acre-satsuma-putnam-fl-ltl-001/index.html",
    "utf8"
  );
  assert.ok(html.includes('class="btn-buy"'), "LTL-001 must render a buy button");
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
