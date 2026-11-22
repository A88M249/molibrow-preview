import type { FastifyInstance } from "fastify";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { OrderError, setB2bOrderStatus } from "../b2b.js";
import { config } from "../config.js";
import { sendMail } from "../mail.js";
import { createOneTimeLink, inviteUrl } from "./b2b.js";
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
  // ── stock & wholesale prices ──
  app.get<{ Querystring: { q?: string } }>("/admin/stock", async (req) => {
    const q = `%${(req.query.q ?? "").trim()}%`;
    const { rows } = await pool.query(
      `SELECT p.sku, p.slug, p.name, p.size, p.stock, p.active, p.price_ore, w.price_ore AS wholesale_ore
         FROM products p LEFT JOIN wholesale_prices w ON w.sku = p.sku
        WHERE p.name ILIKE $1 OR p.sku ILIKE $1 ORDER BY p.name, p.id LIMIT 500`, [q]);
    return rows;
  });

  /** Bulk price list (excl. VAT, øre). priceOre: null removes the override so the account discount applies again. */
  app.put("/admin/wholesale-prices", async (req, reply) => {
    const body = z.object({ prices: z.array(z.object({ sku: z.string().min(1), priceOre: z.number().int().min(0).nullable() })).min(1).max(2000) }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    const skus = body.data.prices.map((p) => p.sku);
    const { rows } = await pool.query("SELECT sku FROM products WHERE sku = ANY($1)", [skus]);
    const known = new Set(rows.map((r) => r.sku));
    const unknown = skus.filter((s) => !known.has(s));
    if (unknown.length) return reply.code(400).send({ error: "Unknown SKUs", unknown: unknown.slice(0, 20) });
    for (const p of body.data.prices) {
      if (p.priceOre === null) await pool.query("DELETE FROM wholesale_prices WHERE sku = $1", [p.sku]);
      else await pool.query("INSERT INTO wholesale_prices (sku, price_ore) VALUES ($1,$2) ON CONFLICT (sku) DO UPDATE SET price_ore = $2", [p.sku, p.priceOre]);
    }
    return { ok: true, updated: body.data.prices.length };
  });

  // ── B2B accounts ──
  app.get<{ Querystring: { status?: string } }>("/admin/b2b/accounts", async (req) => {
    const st = z.enum(["pending", "approved", "rejected"]).safeParse(req.query.status);
    const { rows } = await pool.query(
      `SELECT id, company, org_nr, contact_name, email, phone, address, business_type, website, message, status, discount_pct, (password_hash IS NOT NULL) AS activated, created_at, approved_at
         FROM b2b_accounts ${st.success ? "WHERE status = $1" : ""} ORDER BY created_at DESC LIMIT 300`, st.success ? [st.data] : []);
    return rows;
  });

  app.post<{ Params: { id: string } }>("/admin/b2b/accounts/:id/approve", async (req, reply) => {
    const id = Number(req.params.id);
    const body = z.object({ discountPct: z.number().min(0).max(90).default(0) }).safeParse(req.body ?? {});
    if (!Number.isInteger(id) || !body.success) return reply.code(400).send({ error: "Bad request" });
    const { rows: [a] } = await pool.query(
      "UPDATE b2b_accounts SET status = 'approved', discount_pct = $2, approved_at = COALESCE(approved_at, now()) WHERE id = $1 RETURNING contact_name, email, (password_hash IS NOT NULL) AS activated", [id, body.data.discountPct]);
    if (!a) return reply.code(404).send({ error: "Not found" });
    if (a.activated) return { ok: true, invited: false };
    const url = inviteUrl(await createOneTimeLink(id, "invite", 24 * 7));
    const sent = await sendMail(a.email, "Kontoen din hos BikeLink B2B er godkjent",
      `Hei ${a.contact_name},\n\nSøknaden din er godkjent. Opprett passord her (lenken gjelder i 7 dager):\n${url}\n\nDeretter logger du inn på ${config.siteUrl}/b2b/logg-inn\n\nBikeLink AS`);
    return { ok: true, invited: true, emailSent: sent, inviteUrl: url }; // inviteUrl lets staff pass the link on by hand if email is not set up
  });

  app.post<{ Params: { id: string } }>("/admin/b2b/accounts/:id/reject", async (req, reply) => {
    const { rowCount } = await pool.query("UPDATE b2b_accounts SET status = 'rejected' WHERE id = $1", [Number(req.params.id) || 0]);
    return rowCount ? { ok: true } : reply.code(404).send({ error: "Not found" });
  });

  app.put<{ Params: { id: string } }>("/admin/b2b/accounts/:id/discount", async (req, reply) => {
    const body = z.object({ discountPct: z.number().min(0).max(90) }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    const { rowCount } = await pool.query("UPDATE b2b_accounts SET discount_pct = $2 WHERE id = $1", [Number(req.params.id) || 0, body.data.discountPct]);
    return rowCount ? { ok: true } : reply.code(404).send({ error: "Not found" });
  });

  // ── B2B orders ──
  app.get<{ Querystring: { status?: string } }>("/admin/b2b/orders", async (req) => {
    const st = z.enum(["placed", "confirmed", "shipped", "cancelled"]).safeParse(req.query.status);
    const { rows } = await pool.query(
      `SELECT o.id, o.order_no, o.status, o.reference, o.subtotal_ore, o.created_at, a.company, a.email
         FROM b2b_orders o JOIN b2b_accounts a ON a.id = o.account_id ${st.success ? "WHERE o.status = $1" : ""} ORDER BY o.created_at DESC LIMIT 200`, st.success ? [st.data] : []);
    return rows;
  });

  app.get<{ Params: { id: string } }>("/admin/b2b/orders/:id", async (req, reply) => {
    if (!z.string().uuid().safeParse(req.params.id).success) return reply.code(400).send({ error: "Bad id" });
    const { rows: [o] } = await pool.query("SELECT o.*, a.company, a.email, a.phone FROM b2b_orders o JOIN b2b_accounts a ON a.id = o.account_id WHERE o.id = $1", [req.params.id]);
    if (!o) return reply.code(404).send({ error: "Not found" });
    const { rows: items } = await pool.query("SELECT p.sku, p.name, p.size, i.quantity, i.price_ore FROM b2b_order_items i JOIN products p ON p.id = i.product_id WHERE i.order_id = $1 ORDER BY p.name", [req.params.id]);
    return { ...o, items };
  });

  app.post<{ Params: { id: string } }>("/admin/b2b/orders/:id/status", async (req, reply) => {
    const body = z.object({ status: z.enum(["confirmed", "shipped", "cancelled"]) }).safeParse(req.body);
    if (!body.success || !z.string().uuid().safeParse(req.params.id).success) return reply.code(400).send({ error: "Bad request" });
    try {
      await setB2bOrderStatus(req.params.id, body.data.status);
      return { ok: true };
    } catch (e) {
      if (e instanceof OrderError) return reply.code(409).send({ error: e.message });
      throw e;
    }
  });
}
