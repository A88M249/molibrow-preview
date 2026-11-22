import type { FastifyInstance } from "fastify";
import { pool } from "../db.js";

export async function productRoutes(app: FastifyInstance) {
  app.get("/products", async () => {
    const { rows } = await pool.query(
      "SELECT id, slug, name, description, price_ore, stock, image_url FROM products WHERE active ORDER BY name",
    );
    return rows;
  });

  app.get<{ Params: { slug: string } }>("/products/:slug", async (req, reply) => {
    const { rows } = await pool.query(
      "SELECT id, slug, name, description, price_ore, stock, image_url FROM products WHERE active AND slug = $1",
      [req.params.slug],
    );
    if (!rows[0]) return reply.code(404).send({ error: "Not found" });
    return rows[0];
  });
}
