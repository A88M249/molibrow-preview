import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parsePriceList } from "../src/lib/b2b";
import { CATEGORY_IDS, allProducts, describe, inCategory, kr, listed, products, siblings } from "../src/lib/products";

const INTERNAL = /\bSKU\b|lager \d|Shopify|utkast|Fargevei/i;

test("every variant has a unique, non-empty SKU (cart and checkout key)", () => {
  const skus = allProducts.flatMap((p) => p.variants.map((v) => v.sku));
  assert.ok(skus.every(Boolean), "empty SKU");
  assert.equal(new Set(skus).size, skus.length, "duplicate SKU");
});

test("duplicate Shopify listings are removed from the sellable catalogue", () => {
  assert.ok(products.every((p) => !p.duplicateOf));
  for (const d of allProducts.filter((p) => p.duplicateOf)) assert.ok(allProducts.some((p) => p.handle === d.duplicateOf && !p.duplicateOf), `original missing for ${d.handle}`);
});

test("internal admin notes are never shown as public text", () => {
  for (const p of products) assert.ok(!INTERNAL.test(describe(p)), `${p.handle} exposes an internal note`);
});

test("listings show one card per model, and colourways are symmetric", () => {
  const keys = listed.map((p) => p.modelKey);
  assert.equal(new Set(keys).size, keys.length);
  for (const p of products) for (const s of siblings(p)) assert.ok(siblings(s).some((x) => x.handle === p.handle));
});

test("every product is in a known category and every category has products", () => {
  assert.ok(products.every((p) => CATEGORY_IDS.includes(p.category)));
  for (const c of CATEGORY_IDS) assert.ok(inCategory(c).length > 0, c);
});

test("prices are formatted the Norwegian way", () => {
  assert.equal(kr(8499000), "84 990 kr");
  assert.equal(kr(399000), "3 990 kr");
});

test("redirects point to real routes", () => {
  const ok = new Set(["/", "/forhandlere", "/service", "/om-oss", "/kontakt", "/handlekurv", "/b2b", "/b2b/soknad", "/b2b/logg-inn", "/sykkelinnbytte", "/vilkar", "/angrerett", "/frakt", "/personvern", "/juridisk", ...CATEGORY_IDS.map((c) => `/${c}`)]);
  const redirects: { source: string; destination: string }[] = JSON.parse(readFileSync(new URL("../data/redirects.json", import.meta.url), "utf8"));
  assert.ok(redirects.length > 20);
  for (const r of redirects) assert.ok(ok.has(r.destination.split("#")[0]), `${r.source} -> ${r.destination}`);
});

test("legal pages were imported and contain no raw HTML or scripts", () => {
  for (const slug of ["vilkar", "angrerett", "frakt", "personvern", "juridisk"]) {
    const doc = JSON.parse(readFileSync(new URL(`../data/legal/${slug}.json`, import.meta.url), "utf8"));
    assert.ok(doc.title && doc.blocks.length > 5, slug);
    assert.ok(!/<\/?(script|iframe|style)\b/i.test(JSON.stringify(doc)), `${slug} contains markup`);
  }
});

test("price list import: semicolon/tab separated, decimal comma or point, header skipped", () => {
  const r = parsePriceList("SKU;Pris\n082699;18500\n080755;21 990,50\n080756\t1999.9\nbad;abc\n;100\n");
  assert.deepEqual(r.prices, [{ sku: "082699", priceOre: 1850000 }, { sku: "080755", priceOre: 2199050 }, { sku: "080756", priceOre: 199990 }]);
  assert.equal(r.skipped, 3);
});
