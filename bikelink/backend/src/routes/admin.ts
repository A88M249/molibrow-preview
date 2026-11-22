import type { FastifyInstance } from "fastify";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { config } from "../config.js";
import { pool } from "../db.js";

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** Back-office API. Disabled (404) unless ADMIN_TOKEN is set; every call needs `Authorization: Bearer <token>`. */
export async function adminRoutes(app: FastifyInstance) {
  app.addHook("onRequest", async (req, reply) => {
    if (!config.adminToken) return reply.code(404).send({ error: "Not found" });
    const given = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
    if (!same(given, config.adminToken)) return reply.code(401).send({ error: "Unauthorized" });
  });

  app.get<{ Querystring: { status?: string } }>("/admin/orders", async (req) => {
    const status = z.enum(["pending", "paid", "fulfilled", "cancelled"]).safeParse(req.query.status);
    const { rows } = await pool.query(
      `SELECT id, status, provider, email, total_ore, delivery_method, dealer_id, created_at FROM orders
        ${status.success ? "WHERE status = $1" : ""} ORDER BY created_at DESC LIMIT 200`, status.success ? [status.data] : []);
    return rows;
  });

  app.get<{ Params: { id: string } }>("/admin/orders/:id", async (req, reply) => {
    if (!z.string().uuid().safeParse(req.params.id).success) return reply.code(400).send({ error: "Bad id" });
    const { rows: [order] } = await pool.query("SELECT * FROM orders WHERE id = $1", [req.params.id]);
    if (!order) return reply.code(404).send({ error: "Not found" });
    const { rows: items } = await pool.query(
      "SELECT p.sku, p.name, p.size, i.quantity, i.price_ore FROM order_items i JOIN products p ON p.id = i.product_id WHERE i.order_id = $1", [req.params.id]);
    return { ...order, items };
  });

  app.post<{ Params: { id: string } }>("/admin/orders/:id/fulfil", async (req, reply) => {
    if (!z.string().uuid().safeParse(req.params.id).success) return reply.code(400).send({ error: "Bad id" });
    const { rowCount } = await pool.query("UPDATE orders SET status = 'fulfilled' WHERE id = $1 AND status = 'paid'", [req.params.id]);
    return rowCount ? { ok: true } : reply.code(409).send({ error: "Only paid orders can be fulfilled" });
  });

  app.put<{ Params: { sku: string } }>("/admin/stock/:sku", async (req, reply) => {
    const body = z.object({ stock: z.number().int().min(0).max(10000) }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    const { rowCount } = await pool.query("UPDATE products SET stock = $2 WHERE sku = $1", [req.params.sku, body.data.stock]);
    return rowCount ? { ok: true } : reply.code(404).send({ error: "Unknown SKU" });
  });
}
