import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { hashPassword, newOneTimeToken, sha256, signToken, verifyPassword, verifyToken } from "../auth.js";
import { OrderError, VAT_RATE, catalogFor, placeB2bOrder } from "../b2b.js";
import { config } from "../config.js";
import { pool } from "../db.js";
import { sendMail } from "../mail.js";

const kr = (ore: number) => `${new Intl.NumberFormat("nb-NO").format(Math.round(ore / 100)).replace(/ /g, " ")} kr`;

/** Norwegian organisation number: 9 digits with a mod-11 check digit. */
export function validOrgNr(raw: string): boolean {
  const d = raw.replace(/\s/g, "");
  if (!/^\d{9}$/.test(d)) return false;
  const w = [3, 2, 7, 6, 5, 4, 3, 2];
  const sum = w.reduce((s, x, i) => s + x * Number(d[i]), 0);
  const check = 11 - (sum % 11);
  return check !== 10 && (check === 11 ? 0 : check) === Number(d[8]);
}

const apply = z.object({
  company: z.string().trim().min(2).max(120),
  orgNr: z.string().refine(validOrgNr, "Ugyldig organisasjonsnummer"),
  contactName: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(200),
  phone: z.string().trim().min(5).max(40),
  address: z.string().trim().min(5).max(300),
  businessType: z.string().trim().min(2).max(60),
  website: z.string().trim().max(200).optional(),
  message: z.string().trim().max(1000).optional(),
});

export const inviteUrl = (token: string, purpose: "invite" | "reset" = "invite") =>
  `${config.siteUrl}/b2b/aktiver?token=${token}${purpose === "reset" ? "&reset=1" : ""}`;

/** Creates a one-time link for setting/resetting the password and returns the plain token. */
export async function createOneTimeLink(accountId: number, purpose: "invite" | "reset", hours: number) {
  const { token, hash } = newOneTimeToken();
  await pool.query("UPDATE b2b_tokens SET used_at = now() WHERE account_id = $1 AND used_at IS NULL", [accountId]); // older links stop working
  await pool.query("INSERT INTO b2b_tokens (account_id, token_hash, purpose, expires_at) VALUES ($1,$2,$3, now() + ($4 || ' hours')::interval)", [accountId, hash, purpose, String(hours)]);
  return token;
}

export type Dealer = { id: number; company: string; contactName: string; email: string; address: string; discountPct: number };

async function requireDealer(req: FastifyRequest, reply: FastifyReply): Promise<Dealer | void> {
  if (!config.jwtSecret) return reply.code(503).send({ error: "B2B portal is not configured" });
  const claims = verifyToken<{ sub: number }>((req.headers.authorization ?? "").replace(/^Bearer\s+/i, ""));
  if (!claims) return reply.code(401).send({ error: "Unauthorized" });
  const { rows: [a] } = await pool.query("SELECT id, company, contact_name, email, address, discount_pct, status FROM b2b_accounts WHERE id = $1", [claims.sub]);
  if (!a || a.status !== "approved") return reply.code(401).send({ error: "Unauthorized" }); // revoked accounts lose access at once
  return { id: a.id, company: a.company, contactName: a.contact_name, email: a.email, address: a.address, discountPct: Number(a.discount_pct) };
}

const limit = (max: number) => ({ config: { rateLimit: { max, timeWindow: "1 minute" } } });

export async function b2bRoutes(app: FastifyInstance) {
  app.addHook("onRequest", async (req, reply) => {
    if (!config.jwtSecret) return reply.code(503).send({ error: "B2B portal is not configured" });
  });

  // ── public ──
  app.post("/b2b/apply", limit(5), async (req, reply) => {
    const input = apply.safeParse(req.body);
    if (!input.success) return reply.code(400).send({ error: input.error.flatten().fieldErrors });
    const a = input.data;
    try {
      await pool.query(
        `INSERT INTO b2b_accounts (company, org_nr, contact_name, email, phone, address, business_type, website, message) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [a.company, a.orgNr.replace(/\s/g, ""), a.contactName, a.email, a.phone, a.address, a.businessType, a.website || null, a.message || null]);
    } catch (e) {
      if ((e as { code?: string }).code === "23505") return reply.code(409).send({ error: "Det finnes allerede en søknad eller konto med denne e-postadressen." });
      throw e;
    }
    await sendMail(config.b2bNotifyEmail, `Ny B2B-søknad: ${a.company}`,
      `Ny søknad om B2B-konto.\n\nFirma: ${a.company}\nOrg.nr.: ${a.orgNr}\nKontakt: ${a.contactName}\nE-post: ${a.email}\nTelefon: ${a.phone}\nAdresse: ${a.address}\nType: ${a.businessType}\nNettside: ${a.website ?? "-"}\n\n${a.message ?? ""}\n\nGodkjenn i back-office: ${config.siteUrl}/admin`);
    await sendMail(a.email, "Vi har mottatt søknaden din – BikeLink B2B",
      `Hei ${a.contactName},\n\nTakk for søknaden fra ${a.company}. Alle søknader behandles manuelt. Du får en e-post med lenke til å opprette passord når kontoen er godkjent.\n\nBikeLink AS`);
    return reply.code(201).send({ ok: true });
  });

  app.post("/b2b/login", limit(10), async (req, reply) => {
    const body = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1).max(200) }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "Bad request" });
    const { rows: [a] } = await pool.query("SELECT id, company, contact_name, email, discount_pct, status, password_hash FROM b2b_accounts WHERE email = $1", [body.data.email]);
    const ok = await verifyPassword(body.data.password, a?.password_hash ?? null);
    if (!a || !ok || a.status !== "approved") return reply.code(401).send({ error: "Feil e-post eller passord" });
    return { token: signToken({ sub: a.id }, 12 * 3600), account: { company: a.company, contactName: a.contact_name, email: a.email } };
  });

  app.post("/b2b/activate", limit(10), async (req, reply) => {
    const body = z.object({ token: z.string().min(20).max(100), password: z.string().min(10, "Passordet må ha minst 10 tegn").max(200) }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten().fieldErrors });
    const { rows: [t] } = await pool.query(
      `SELECT t.id, t.account_id FROM b2b_tokens t JOIN b2b_accounts a ON a.id = t.account_id
        WHERE t.token_hash = $1 AND t.used_at IS NULL AND t.expires_at > now() AND a.status = 'approved'`, [sha256(body.data.token)]);
    if (!t) return reply.code(400).send({ error: "Lenken er ugyldig eller utløpt. Be om en ny." });
    await pool.query("UPDATE b2b_accounts SET password_hash = $2 WHERE id = $1", [t.account_id, await hashPassword(body.data.password)]);
    await pool.query("UPDATE b2b_tokens SET used_at = now() WHERE account_id = $1 AND used_at IS NULL", [t.account_id]);
    return { ok: true };
  });

  // Always answers 200 so nobody can probe which emails have accounts.
  app.post("/b2b/forgot", limit(5), async (req) => {
    const body = z.object({ email: z.string().trim().toLowerCase().email() }).safeParse(req.body);
    if (body.success) {
      const { rows: [a] } = await pool.query("SELECT id, contact_name FROM b2b_accounts WHERE email = $1 AND status = 'approved'", [body.data.email]);
      if (a) {
        const token = await createOneTimeLink(a.id, "reset", 2);
        await sendMail(body.data.email, "Nytt passord – BikeLink B2B", `Hei ${a.contact_name},\n\nOpprett nytt passord her (lenken gjelder i 2 timer):\n${inviteUrl(token, "reset")}\n\nHvis du ikke ba om dette kan du ignorere e-posten.`);
      }
    }
    return { ok: true };
  });

  // ── signed-in dealers ──
  app.get("/b2b/me", async (req, reply) => {
    const d = await requireDealer(req, reply);
    if (d) return { company: d.company, contactName: d.contactName, email: d.email, address: d.address, discountPct: d.discountPct };
  });

  app.get("/b2b/catalog", async (req, reply) => {
    const d = await requireDealer(req, reply);
    if (!d) return;
    const { rows: [f] } = await pool.query("SELECT max(stock_updated_at) AS at FROM products");
    return { vatRate: VAT_RATE, stockUpdatedAt: f?.at ?? null, items: await catalogFor(d.discountPct) };
  });

  app.post("/b2b/orders", limit(30), async (req, reply) => {
    const d = await requireDealer(req, reply);
    if (!d) return;
    const body = z.object({
      items: z.array(z.object({ sku: z.string().min(1), quantity: z.number().int().min(1).max(500) })).min(1).max(100),
      reference: z.string().trim().max(60).optional(),
      note: z.string().trim().max(500).optional(),
      deliveryAddress: z.string().trim().max(300).optional(),
    }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    try {
      const o = await placeB2bOrder(d, body.data.items, { reference: body.data.reference, note: body.data.note, deliveryAddress: body.data.deliveryAddress || d.address });
      const lines = o.lines.map((l) => `- ${l.name}${l.size ? ` (${l.size})` : ""} × ${l.quantity} à ${kr(l.priceOre)}`).join("\n");
      const text = `Ordre BL-${o.orderNo} fra ${d.company}\n\n${lines}\n\nSum eks. mva: ${kr(o.subtotalOre)}\nMva ${VAT_RATE * 100} %: ${kr(Math.round(o.subtotalOre * VAT_RATE))}\nSum inkl. mva: ${kr(Math.round(o.subtotalOre * (1 + VAT_RATE)))}\n\nLevering: ${body.data.deliveryAddress || d.address}\nReferanse: ${body.data.reference ?? "-"}\nOppgjør: faktura etter avtale.`;
      await sendMail(d.email, `Ordrebekreftelse BL-${o.orderNo} – BikeLink B2B`, text);
      await sendMail(config.b2bNotifyEmail, `Ny B2B-ordre BL-${o.orderNo}: ${d.company}`, text);
      return reply.code(201).send({ id: o.id, orderNo: o.orderNo, subtotalOre: o.subtotalOre });
    } catch (e) {
      if (e instanceof OrderError) return reply.code(409).send({ error: e.message });
      throw e;
    }
  });

  app.get("/b2b/orders", async (req, reply) => {
    const d = await requireDealer(req, reply);
    if (!d) return;
    const { rows } = await pool.query(
      `SELECT o.id, o.order_no, o.status, o.reference, o.subtotal_ore, o.created_at, COALESCE(SUM(i.quantity),0)::int AS units
         FROM b2b_orders o LEFT JOIN b2b_order_items i ON i.order_id = o.id WHERE o.account_id = $1 GROUP BY o.id ORDER BY o.created_at DESC LIMIT 200`, [d.id]);
    return rows;
  });

  app.get<{ Params: { id: string } }>("/b2b/orders/:id", async (req, reply) => {
    const d = await requireDealer(req, reply);
    if (!d) return;
    if (!z.string().uuid().safeParse(req.params.id).success) return reply.code(400).send({ error: "Bad id" });
    const { rows: [o] } = await pool.query("SELECT id, order_no, status, reference, note, delivery_address, subtotal_ore, created_at FROM b2b_orders WHERE id = $1 AND account_id = $2", [req.params.id, d.id]);
    if (!o) return reply.code(404).send({ error: "Not found" });
    const { rows: items } = await pool.query("SELECT p.sku, p.name, p.size, i.quantity, i.price_ore FROM b2b_order_items i JOIN products p ON p.id = i.product_id WHERE i.order_id = $1 ORDER BY p.name", [o.id]);
    return { ...o, items };
  });
}
