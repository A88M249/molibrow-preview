import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { audit, requireAdmin } from "../admin-auth.js";
import { OrderError, setB2bOrderStatus } from "../b2b.js";
import { config } from "../config.js";
import { sendMail } from "../mail.js";
import { CsvError } from "../stock-csv.js";
import { applyImport, diffFor, ingestStockFile, rejectImport, safetyProblem } from "../stock-import.js";
import { createOneTimeLink, inviteUrl, validOrgNr } from "./b2b.js";
import { pool } from "../db.js";

/** Back-office API. Every call needs a staff session (email + password + authenticator code, see admin-auth.ts). */
export async function adminRoutes(app: FastifyInstance) {
  app.addHook("onRequest", requireAdmin());

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
    if (rowCount) await audit(req, "order.fulfilled", { id: req.params.id });
    return rowCount ? { ok: true } : reply.code(409).send({ error: "Only paid orders can be fulfilled" });
  });

  app.put<{ Params: { sku: string } }>("/admin/stock/:sku", async (req, reply) => {
    const body = z.object({ stock: z.number().int().min(0).max(10000) }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    const { rowCount } = await pool.query("UPDATE products SET stock = $2 WHERE sku = $1", [req.params.sku, body.data.stock]);
    if (rowCount) await audit(req, "stock.set", { sku: req.params.sku, stock: body.data.stock });
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
    await audit(req, "wholesale.prices", { count: body.data.prices.length });
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

  /** Add a B2B partner yourself (e.g. an existing customer): created as approved, with an invite link to choose a password. */
  app.post("/admin/b2b/accounts", async (req, reply) => {
    const body = z.object({
      company: z.string().trim().min(2).max(120), orgNr: z.string().refine(validOrgNr, "Ugyldig organisasjonsnummer"), contactName: z.string().trim().min(2).max(120),
      email: z.string().trim().toLowerCase().email().max(200), phone: z.string().trim().min(5).max(40), address: z.string().trim().min(5).max(300),
      businessType: z.string().trim().min(2).max(60).default("Forhandler"), discountPct: z.number().min(0).max(90).default(0),
    }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    const b = body.data;
    let id: number;
    try {
      ({ rows: [{ id }] } = await pool.query(
        `INSERT INTO b2b_accounts (company, org_nr, contact_name, email, phone, address, business_type, status, discount_pct, approved_at) VALUES ($1,$2,$3,$4,$5,$6,$7,'approved',$8, now()) RETURNING id`,
        [b.company, b.orgNr.replace(/\s/g, ""), b.contactName, b.email, b.phone, b.address, b.businessType, b.discountPct]));
    } catch (e) {
      if ((e as { code?: string }).code === "23505") return reply.code(409).send({ error: "Det finnes allerede en konto med denne e-postadressen." });
      throw e;
    }
    const url = inviteUrl(await createOneTimeLink(id, "invite", 24 * 7));
    const sent = await sendMail(b.email, "Kontoen din hos BikeLink B2B er opprettet", `Hei ${b.contactName},\n\nDu er lagt til som B2B-partner. Opprett passord her (lenken gjelder i 7 dager):\n${url}\n\nBikeLink AS`);
    await audit(req, "b2b.created", { id, company: b.company, discountPct: b.discountPct });
    return reply.code(201).send({ id, inviteUrl: url, emailSent: sent });
  });

  app.post<{ Params: { id: string } }>("/admin/b2b/accounts/:id/approve", async (req, reply) => {
    const id = Number(req.params.id);
    const body = z.object({ discountPct: z.number().min(0).max(90).default(0) }).safeParse(req.body ?? {});
    if (!Number.isInteger(id) || !body.success) return reply.code(400).send({ error: "Bad request" });
    const { rows: [a] } = await pool.query(
      "UPDATE b2b_accounts SET status = 'approved', discount_pct = $2, approved_at = COALESCE(approved_at, now()) WHERE id = $1 RETURNING contact_name, email, (password_hash IS NOT NULL) AS activated", [id, body.data.discountPct]);
    if (!a) return reply.code(404).send({ error: "Not found" });
    await audit(req, "b2b.approved", { id, discountPct: body.data.discountPct });
    if (a.activated) return { ok: true, invited: false };
    const url = inviteUrl(await createOneTimeLink(id, "invite", 24 * 7));
    const sent = await sendMail(a.email, "Kontoen din hos BikeLink B2B er godkjent",
      `Hei ${a.contact_name},\n\nSøknaden din er godkjent. Opprett passord her (lenken gjelder i 7 dager):\n${url}\n\nDeretter logger du inn på ${config.siteUrl}/b2b/logg-inn\n\nBikeLink AS`);
    return { ok: true, invited: true, emailSent: sent, inviteUrl: url }; // inviteUrl lets staff pass the link on by hand if email is not set up
  });

  app.post<{ Params: { id: string } }>("/admin/b2b/accounts/:id/reject", async (req, reply) => {
    const { rowCount } = await pool.query("UPDATE b2b_accounts SET status = 'rejected' WHERE id = $1", [Number(req.params.id) || 0]);
    if (rowCount) await audit(req, "b2b.rejected", { id: req.params.id });
    return rowCount ? { ok: true } : reply.code(404).send({ error: "Not found" });
  });

  app.put<{ Params: { id: string } }>("/admin/b2b/accounts/:id/discount", async (req, reply) => {
    const body = z.object({ discountPct: z.number().min(0).max(90) }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    const { rowCount } = await pool.query("UPDATE b2b_accounts SET discount_pct = $2 WHERE id = $1", [Number(req.params.id) || 0, body.data.discountPct]);
    if (rowCount) await audit(req, "b2b.discount", { id: req.params.id, discountPct: body.data.discountPct });
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
      await audit(req, "b2b.order." + body.data.status, { id: req.params.id });
      return { ok: true };
    } catch (e) {
      if (e instanceof OrderError) return reply.code(409).send({ error: e.message });
      throw e;
    }
  });
  // ── stock imports (daily CSV from MMR) ──
  app.get("/admin/stock-imports", async () => {
    const { rows } = await pool.query(
      `SELECT id, created_at, as_of, source, sender, filename, status, message, rows_total, matched, unmatched, changed, applied_at, applied_by
         FROM stock_imports ORDER BY created_at DESC LIMIT 60`);
    return { autoApply: config.stock.autoApply, maxDropPct: config.stock.maxDropPct, missing: config.stock.missing, imports: rows };
  });

  app.get<{ Params: { id: string } }>("/admin/stock-imports/:id", async (req, reply) => {
    const { rows: [imp] } = await pool.query("SELECT * FROM stock_imports WHERE id = $1", [Number(req.params.id) || 0]);
    if (!imp) return reply.code(404).send({ error: "Not found" });
    const { parsed, ...meta } = imp;
    if (imp.status !== "pending") return { ...meta, changes: [], changesTotal: imp.changed, problem: null };
    const d = await diffFor(parsed, imp.unmatched_skus, new Date(imp.as_of));
    const active = (await pool.query("SELECT count(*)::int AS n FROM products WHERE active")).rows[0].n;
    return { ...meta, changes: d.changes.slice(0, 500), changesTotal: d.changes.length, totalBefore: d.totalBefore, totalAfter: d.totalAfter, problem: safetyProblem(d, active) };
  });

  /** Manual upload (same pipeline as email, but it always waits for an explicit apply). */
  app.post("/admin/stock-imports", { bodyLimit: 8 * 1024 * 1024 }, async (req, reply) => {
    // csvBase64 = the file's raw bytes (keeps Windows-1252 exports intact); csv = plain text (handy for scripts)
    const body = z.object({ filename: z.string().max(200).optional(), csv: z.string().min(1).optional(), csvBase64: z.string().min(1).optional() }).refine((b) => b.csv || b.csvBase64, "csv or csvBase64 required").safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    const content = body.data.csvBase64 ? Buffer.from(body.data.csvBase64, "base64") : Buffer.from(body.data.csv!, "utf8");
    const r = await ingestStockFile({ content, filename: body.data.filename ?? "opplastet.csv", source: "upload", autoApply: false });
    await audit(req, "stock.import.uploaded", { id: r.id, status: r.status });
    return reply.code(r.status === "failed" ? 422 : 201).send(r);
  });

  app.post<{ Params: { id: string } }>("/admin/stock-imports/:id/apply", async (req, reply) => {
    const body = z.object({ force: z.boolean().optional() }).safeParse(req.body ?? {});
    try { const r = await applyImport(Number(req.params.id) || 0, req.admin!.email, { force: body.success ? body.data.force : false }); await audit(req, "stock.import.apply", { id: req.params.id, status: r.status, force: body.success ? body.data.force : false }); return r; }
    catch (e) { if (e instanceof CsvError) return reply.code(409).send({ error: e.message }); throw e; }
  });

  app.post<{ Params: { id: string } }>("/admin/stock-imports/:id/reject", async (req, reply) => {
    const ok = await rejectImport(Number(req.params.id) || 0, req.admin!.email);
    if (ok) await audit(req, "stock.import.reject", { id: req.params.id });
    return ok ? { ok: true } : reply.code(409).send({ error: "Only pending imports can be rejected" });
  });
}
