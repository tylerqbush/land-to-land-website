import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const properties = JSON.parse(
  readFileSync("src/_data/properties.json", "utf8")
);

test("properties.json is an array with at least one entry", () => {
  assert.ok(Array.isArray(properties));
  assert.ok(properties.length >= 1);
});

test("each property has required identity fields", () => {
  for (const p of properties) {
    assert.ok(p.id, `${p.id}: missing id`);
    assert.ok(p.slug, `${p.id}: missing slug`);
    assert.ok(p.city, `${p.id}: missing city`);
    assert.ok(p.county, `${p.id}: missing county`);
    assert.ok(p.state, `${p.id}: missing state`);
  }
});

test("each property has a valid status", () => {
  const valid = ["Active", "Under Contract", "Sold"];
  for (const p of properties) {
    assert.ok(valid.includes(p.status), `${p.id}: invalid status "${p.status}"`);
  }
});

test("each property has positive numeric pricing", () => {
  for (const p of properties) {
    assert.ok(typeof p.monthly === "number" && p.monthly > 0, `${p.id}: monthly must be positive number`);
    assert.ok(typeof p.down === "number" && p.down >= 0, `${p.id}: down must be non-negative number`);
    assert.ok(typeof p.doc_fee === "number" && p.doc_fee >= 0, `${p.id}: doc_fee must be non-negative number`);
  }
});

test("slug format matches {acreage}-acre-{city}-{county}-{state}-{id} pattern", () => {
  for (const p of properties) {
    assert.match(p.slug, /^[a-z0-9-]+$/, `${p.id}: slug must be lowercase kebab: ${p.slug}`);
    assert.ok(p.slug.startsWith(`${p.acreage}-acre-`), `${p.id}: slug must start with "${p.acreage}-acre-"`);
    assert.ok(p.slug.endsWith(`-${p.id.toLowerCase()}`), `${p.id}: slug must end with "-${p.id.toLowerCase()}"`);
  }
});

test("geekpay_url is null or a full https URL", () => {
  for (const p of properties) {
    assert.ok(
      p.geekpay_url === null ||
        (typeof p.geekpay_url === "string" && /^https?:\/\//.test(p.geekpay_url)),
      `${p.id}: geekpay_url must be null or a full URL starting with https://`
    );
  }
});

test("at least one property has null geekpay_url to validate no-button rule", () => {
  const noGeekPay = properties.filter((p) => p.geekpay_url === null);
  assert.ok(noGeekPay.length >= 1, "need at least one property with null geekpay_url");
});

test("each property has lat and lng for map rendering", () => {
  for (const p of properties) {
    assert.ok(typeof p.lat === "number", `${p.id}: missing lat`);
    assert.ok(typeof p.lng === "number", `${p.id}: missing lng`);
  }
});

test("cash_price is a positive number when present", () => {
  for (const p of properties) {
    if (p.cash_price !== undefined && p.cash_price !== null) {
      assert.ok(typeof p.cash_price === "number" && p.cash_price > 0, `${p.id}: cash_price must be positive number`);
    }
  }
});

test("each property has seo_title, seo_description, and seo_keywords as non-empty strings", () => {
  for (const p of properties) {
    assert.ok(typeof p.seo_title === "string" && p.seo_title.length > 0, `${p.id}: missing seo_title`);
    assert.ok(typeof p.seo_description === "string" && p.seo_description.length > 0, `${p.id}: missing seo_description`);
    assert.ok(typeof p.seo_keywords === "string" && p.seo_keywords.length > 0, `${p.id}: missing seo_keywords`);
  }
});
