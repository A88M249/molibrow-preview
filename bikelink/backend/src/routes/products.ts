import type { FastifyInstance } from "fastify";
import { pool } from "../db.js";

// The public API only says "10+" instead of the exact number, so competitors cannot watch the warehouse.
const capStock = <T extends { stock: number }>(r: T) => ({ ...r, stock: Math.min(r.stock, 10) });

export async function productRoutes(app: FastifyInstance) {
  app.get("/products", async () => {
    const { rows } = await pool.query(
      "SELECT id, sku, slug, name, size, description, price_ore, stock, image_url FROM products WHERE active ORDER BY name, id",
    );
    return rows.map(capStock);
  });

  app.get<{ Params: { slug: string } }>("/products/:slug", async (req, reply) => {
    const { rows } = await pool.query(
      "SELECT id, sku, slug, name, size, description, price_ore, stock, image_url FROM products WHERE active AND slug = $1 ORDER BY id",
      [req.params.slug],
    );
    if (!rows.length) return reply.code(404).send({ error: "Not found" });
    return { slug: req.params.slug, name: rows[0].name, variants: rows.map(capStock) };
  });
}
