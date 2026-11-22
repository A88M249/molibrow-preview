import type { FastifyInstance } from "fastify";
import { pool } from "../db.js";

export async function productRoutes(app: FastifyInstance) {
  app.get("/products", async () => {
    const { rows } = await pool.query(
      "SELECT id, sku, slug, name, size, description, price_ore, stock, image_url FROM products WHERE active ORDER BY name, id",
    );
    return rows;
  });

  app.get<{ Params: { slug: string } }>("/products/:slug", async (req, reply) => {
    const { rows } = await pool.query(
      "SELECT id, sku, slug, name, size, description, price_ore, stock, image_url FROM products WHERE active AND slug = $1 ORDER BY id",
      [req.params.slug],
    );
    if (!rows.length) return reply.code(404).send({ error: "Not found" });
    return { slug: req.params.slug, name: rows[0].name, variants: rows };
  });
}
