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
    const parts = p.slug.split("-");
    assert.ok(parts.includes("acre"), `${p.id}: slug missing 'acre': ${p.slug}`);
    assert.match(p.slug, /^[a-z0-9-]+$/, `${p.id}: slug must be lowercase kebab: ${p.slug}`);
  }
});

test("geekpay_url is null or a non-empty string", () => {
  for (const p of properties) {
    assert.ok(
      p.geekpay_url === null || (typeof p.geekpay_url === "string" && p.geekpay_url.length > 0),
      `${p.id}: geekpay_url must be null or non-empty string`
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
