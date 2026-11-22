import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { audit, requireAdmin } from "../admin-auth.js";
import { newOneTimeToken } from "../auth.js";
import { config } from "../config.js";
import { pool } from "../db.js";
import { sendMail } from "../mail.js";

export const adminInviteUrl = (token: string) => `${config.siteUrl}/admin/aktiver?token=${token}`;

/** New one-time link to choose a password (invite or reset); older links stop working. */
export async function createAdminInvite(adminId: number, days = 3): Promise<string> {
  const { token, hash } = newOneTimeToken();
  await pool.query("UPDATE admin_tokens SET used_at = now() WHERE admin_id = $1 AND used_at IS NULL", [adminId]);
  await pool.query("INSERT INTO admin_tokens (admin_id, token_hash, purpose, expires_at) VALUES ($1,$2,'invite', now() + ($3 || ' days')::interval)", [adminId, hash, String(days)]);
  return adminInviteUrl(token);
}

/** Staff management. Owners only. */
export async function adminUserRoutes(app: FastifyInstance) {
  app.addHook("onRequest", requireAdmin({ owner: true }));

  app.get("/admin/users", async () => {
    const { rows } = await pool.query(
      `SELECT id, email, name, role, disabled, totp_enabled, (password_hash IS NOT NULL) AS has_password, last_login_at, created_at, (locked_until IS NOT NULL AND locked_until > now()) AS locked
         FROM admin_users ORDER BY created_at`);
    return rows;
  });

  app.post("/admin/users", async (req, reply) => {
    const body = z.object({ email: z.string().trim().toLowerCase().email().max(200), name: z.string().trim().max(120).optional(), role: z.enum(["owner", "staff"]).default("staff") }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    let id: number;
    try {
      ({ rows: [{ id }] } = await pool.query("INSERT INTO admin_users (email, name, role) VALUES ($1,$2,$3) RETURNING id", [body.data.email, body.data.name ?? null, body.data.role]));
    } catch (e) {
      if ((e as { code?: string }).code === "23505") return reply.code(409).send({ error: "Det finnes allerede en bruker med denne e-postadressen." });
      throw e;
    }
    const url = await createAdminInvite(id);
    const sent = await sendMail(body.data.email, "Du er invitert til BikeLink back-office",
      `Hei${body.data.name ? ` ${body.data.name}` : ""},\n\nDu er lagt til i BikeLink back-office. Velg passord her (lenken gjelder i 3 dager):\n${url}\n\nVed første innlogging setter du opp tofaktor-godkjenning med en autentiseringsapp (Google Authenticator, 1Password, Authy …).`);
    await audit(req, "user.invited", { email: body.data.email, role: body.data.role });
    return reply.code(201).send({ id, inviteUrl: url, emailSent: sent });
  });

  app.post<{ Params: { id: string } }>("/admin/users/:id/invite", async (req, reply) => {
    const id = Number(req.params.id);
    const { rows: [u] } = await pool.query("SELECT id, email, name FROM admin_users WHERE id = $1", [id]);
    if (!u) return reply.code(404).send({ error: "Not found" });
    const url = await createAdminInvite(id);
    const sent = await sendMail(u.email, "Nytt passord – BikeLink back-office", `Velg nytt passord her (lenken gjelder i 3 dager):\n${url}`);
    await audit(req, "user.reinvited", { email: u.email });
    return { inviteUrl: url, emailSent: sent };
  });

  const guardLastOwner = async (id: number) => {
    const { rows: [o] } = await pool.query("SELECT count(*)::int AS n FROM admin_users WHERE role = 'owner' AND NOT disabled AND id <> $1", [id]);
    return o.n > 0;
  };

  app.post<{ Params: { id: string } }>("/admin/users/:id/disable", async (req, reply) => {
    const id = Number(req.params.id);
    if (id === req.admin!.id) return reply.code(409).send({ error: "Du kan ikke deaktivere deg selv." });
    if (!(await guardLastOwner(id))) return reply.code(409).send({ error: "Må alltid finnes minst én aktiv eier." });
    const { rows: [u] } = await pool.query("UPDATE admin_users SET disabled = true, session_version = session_version + 1 WHERE id = $1 RETURNING email", [id]);
    if (!u) return reply.code(404).send({ error: "Not found" });
    await audit(req, "user.disabled", { email: u.email });
    return { ok: true };
  });

  app.post<{ Params: { id: string } }>("/admin/users/:id/enable", async (req, reply) => {
    const { rows: [u] } = await pool.query("UPDATE admin_users SET disabled = false, failed_attempts = 0, locked_until = NULL WHERE id = $1 RETURNING email", [Number(req.params.id)]);
    if (!u) return reply.code(404).send({ error: "Not found" });
    await audit(req, "user.enabled", { email: u.email });
    return { ok: true };
  });

  /** Lost phone: removes the second factor and signs the user out; they set it up again at the next login. */
  app.post<{ Params: { id: string } }>("/admin/users/:id/reset-2fa", async (req, reply) => {
    const { rows: [u] } = await pool.query(
      "UPDATE admin_users SET totp_secret_enc = NULL, totp_enabled = false, totp_last_step = 0, recovery_hashes = '{}', session_version = session_version + 1, failed_attempts = 0, locked_until = NULL WHERE id = $1 RETURNING email", [Number(req.params.id)]);
    if (!u) return reply.code(404).send({ error: "Not found" });
    await audit(req, "user.2fa_reset", { email: u.email });
    return { ok: true };
  });

  app.post<{ Params: { id: string } }>("/admin/users/:id/unlock", async (req, reply) => {
    const { rowCount } = await pool.query("UPDATE admin_users SET failed_attempts = 0, locked_until = NULL WHERE id = $1", [Number(req.params.id)]);
    return rowCount ? { ok: true } : reply.code(404).send({ error: "Not found" });
  });

  app.get("/admin/audit", async () => (await pool.query("SELECT id, at, email, action, detail, ip FROM admin_audit ORDER BY at DESC LIMIT 200")).rows);
}
