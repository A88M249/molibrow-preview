import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { VAT_RATE, parsePriceList, priceBreakdown } from "../src/lib/b2b";
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

test("sync-stock: availability follows the API, unknown SKUs are left alone", async () => {
  const { applyStock } = await import("../scripts/sync-stock.mjs");
  const products = [{ handle: "a", variants: [{ sku: "1", available: true }, { sku: "2", available: false }, { sku: "3", available: true }] }];
  const r = applyStock(products, [{ sku: "1", stock: 0 }, { sku: "2", stock: 4 }]);
  assert.deepEqual(r.products[0].variants.map((v: { available: boolean }) => v.available), [false, true, true]);
  assert.equal(r.changed, 2); assert.equal(r.known, 2);
  assert.equal(products[0].variants[0].available, true, "input is not mutated");
});

test("B2B price breakdown: ex/incl. VAT and the dealer's margin at the recommended retail price", () => {
  const b = priceBreakdown(5899000, 3775400); // 58 990 kr retail incl. VAT, B2B 37 754 kr excl. VAT
  assert.equal(b.retailExVatOre, 4719200);
  assert.equal(b.b2bIncVatOre, 4719250);
  assert.equal(b.marginOre, 943800);
  assert.ok(Math.abs(b.marginPct - 20) < 0.01, "20 % of the selling price");
  assert.ok(Math.abs(b.markupPct - 25) < 0.01, "= 25 % mark-up on cost");
  assert.ok(priceBreakdown(1000000, 900000).marginOre < 0, "a B2B price above the retail price shows as negative margin");
});

test("VAT is the Norwegian standard rate, 25 %", () => {
  assert.equal(VAT_RATE, 0.25);
  assert.equal(priceBreakdown(12500, 8000).retailExVatOre, 10000, "125 kr incl. VAT = 100 kr excl. VAT");
  assert.equal(priceBreakdown(12500, 8000).b2bIncVatOre, 10000, "80 kr excl. VAT = 100 kr incl. VAT");
});

test("every size exists once per colour, and multi-colour products tag their photos and variants", () => {
  for (const p of products) {
    const keys = p.variants.map((v) => `${v.colour ?? ""}|${v.size ?? ""}`);
    assert.equal(new Set(keys).size, keys.length, `${p.handle} repeats a colour/size`);
    if (p.colours.length > 1) assert.ok(p.variants.every((v) => v.colour && p.colours.includes(v.colour)), `${p.handle} has a variant without a colour`);
  }
  assert.ok(products.filter((p) => p.colours.length > 1).length >= 30, "most products are multi-colour");
});
