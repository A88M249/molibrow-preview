// Loads the catalogue exported by web/scripts/import-shopify.mjs into Postgres.
// Run: npm run seed   (needs DATABASE_URL)
import { readFileSync } from "node:fs";
import pg from "pg";

type P = { handle: string; title: string; description: string; images: { src: string }[]; variants: { sku: string; size: string | null; priceOre: number; available: boolean }[] };
const products: P[] = JSON.parse(readFileSync(new URL("../../web/data/products.json", import.meta.url), "utf8"));

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
let rows = 0, skipped = 0;
for (const p of products) {
  for (const v of p.variants) {
    if (!v.sku) { skipped++; continue; }
    // Shopify's public feed has no stock counts: available = 1 unit. Replace with real inventory before launch.
    await pool.query(
      `INSERT INTO products (sku, slug, name, size, description, price_ore, stock, image_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (sku) DO UPDATE SET slug=$2, name=$3, size=$4, description=$5, price_ore=$6, image_url=$8`,
      [v.sku, p.handle, p.title, v.size, p.description, v.priceOre, v.available ? 1 : 0, p.images[0]?.src ?? null],
    );
    rows++;
  }
}
await pool.end();
console.log(`Seeded ${rows} variants (${skipped} skipped: no SKU). NOTE: stock is 1 for available variants – set real stock.`);
