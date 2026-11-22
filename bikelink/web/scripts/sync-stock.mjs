// Refreshes data/products.json availability from the backend stock database, so the pre-rendered site
// (listings, "Utsolgt" tags, structured data) matches reality at build time.
// Runs automatically before `npm run build` when NEXT_PUBLIC_API_URL is set. Never fails the build.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

/** Pure: returns the products with `available` set from the API rows (SKUs the API does not know keep their value). */
export function applyStock(products, rows) {
  const stock = new Map(rows.map((r) => [r.sku, r.stock]));
  let changed = 0;
  const out = products.map((p) => ({
    ...p,
    variants: p.variants.map((v) => {
      if (!stock.has(v.sku)) return v;
      const available = stock.get(v.sku) > 0;
      if (available !== v.available) changed++;
      return { ...v, available };
    }),
  }));
  return { products: out, changed, known: stock.size };
}

async function main() {
  const api = process.env.NEXT_PUBLIC_API_URL;
  if (!api) { console.log("sync-stock: NEXT_PUBLIC_API_URL not set, keeping data/products.json as it is"); return; }
  const file = new URL("../data/products.json", import.meta.url);
  try {
    const res = await fetch(`${api}/products`, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`API answered ${res.status}`);
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length < 10) throw new Error(`API returned only ${Array.isArray(rows) ? rows.length : "no"} variants – not trusting it`);
    const { products, changed, known } = applyStock(JSON.parse(await readFile(file, "utf8")), rows);
    await writeFile(file, JSON.stringify(products));
    console.log(`sync-stock: ${known} variants from the API, ${changed} availability changes`);
  } catch (e) {
    console.warn(`sync-stock: skipped (${e.message}) – building with the existing data`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
