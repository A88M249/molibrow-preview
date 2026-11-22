import type { FastifyInstance } from "fastify";
import QRCode from "qrcode";
import { z } from "zod";
import { audit, challengeToken, currentAdmin, passwordProblem, sessionToken } from "../admin-auth.js";
import { hashPassword, sha256, verifyPassword, verifyToken } from "../auth.js";
import { config, rateLimit } from "../config.js";
import { pool } from "../db.js";
import { decryptSecret, encryptSecret, hashRecovery, newRecoveryCodes, newSecret, otpauthUri, stepAt, verifyCode } from "../totp.js";

const MAX_FAILS = 5;
const LOCK_MINUTES = 15;
const limit = rateLimit;
const GENERIC = "Feil e-post, passord eller kode";

type Row = { id: number; email: string; name: string | null; role: string; password_hash: string | null; totp_secret_enc: string | null; totp_enabled: boolean; totp_last_step: string; recovery_hashes: string[]; disabled: boolean; failed_attempts: number; locked_until: Date | null; session_version: number };
const load = async (id: number) => (await pool.query("SELECT * FROM admin_users WHERE id = $1", [id])).rows[0] as Row | undefined;

async function fail(u: Pick<Row, "id" | "email">, reason: string, req: Parameters<typeof audit>[0]) {
  const { rows: [r] } = await pool.query(
    `UPDATE admin_users SET failed_attempts = failed_attempts + 1,
       locked_until = CASE WHEN failed_attempts + 1 >= $2 THEN now() + ($3 || ' minutes')::interval ELSE locked_until END
     WHERE id = $1 RETURNING failed_attempts, locked_until`, [u.id, MAX_FAILS, String(LOCK_MINUTES)]);
  await audit(req, "login.failed", { reason, attempts: r.failed_attempts, locked: Boolean(r.locked_until && r.locked_until > new Date()) }, u);
}

export async function adminAuthRoutes(app: FastifyInstance) {
  app.addHook("onRequest", async (req, reply) => { if (!config.jwtSecret) return reply.code(503).send({ error: "Back-office is not configured" }); });

  // Step 1: email + password → tells the browser which second step comes next.
  app.post("/admin/auth/login", limit(10), async (req, reply) => {
    const body = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1).max(200) }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "Bad request" });
    const { rows: [u] } = await pool.query("SELECT * FROM admin_users WHERE email = $1", [body.data.email]);
    const locked = u?.locked_until && new Date(u.locked_until) > new Date();
    if (locked) return reply.code(429).send({ error: `For mange forsøk. Kontoen er låst i ${LOCK_MINUTES} minutter.` });
    const ok = await verifyPassword(body.data.password, u?.password_hash ?? null); // same work whether or not the account exists
    if (!u || !ok || u.disabled) { if (u) await fail(u, u.disabled ? "disabled" : "password", req); return reply.code(401).send({ error: GENERIC }); }
    const stage = u.totp_enabled ? "totp" : "enroll";
    return { step: stage, challenge: challengeToken(u.id, stage) };
  });

  // Step 2a: authenticator code (or a recovery code) → session.
  app.post("/admin/auth/totp", limit(10), async (req, reply) => {
    const body = z.object({ challenge: z.string().min(10), code: z.string().trim().min(6).max(20) }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "Bad request" });
    const claims = verifyToken<{ typ: string; sub: number; stage: string }>(body.data.challenge);
    if (!claims || claims.typ !== "admin-challenge" || claims.stage !== "totp") return reply.code(401).send({ error: "Innloggingen er utløpt. Start på nytt." });
    const u = await load(claims.sub);
    if (!u || u.disabled || !u.totp_enabled || !u.totp_secret_enc) return reply.code(401).send({ error: GENERIC });
    if (u.locked_until && new Date(u.locked_until) > new Date()) return reply.code(429).send({ error: `For mange forsøk. Kontoen er låst i ${LOCK_MINUTES} minutter.` });

    let used = "totp";
    const step = verifyCode(decryptSecret(u.totp_secret_enc), body.data.code);
    if (step !== null && step > Number(u.totp_last_step)) {
      // single use: a code that was already accepted cannot be replayed
      const { rowCount } = await pool.query("UPDATE admin_users SET totp_last_step = $2 WHERE id = $1 AND totp_last_step < $2", [u.id, step]);
      if (!rowCount) { await fail(u, "replay", req); return reply.code(401).send({ error: GENERIC }); }
    } else {
      const h = hashRecovery(body.data.code);
      const { rowCount } = await pool.query("UPDATE admin_users SET recovery_hashes = array_remove(recovery_hashes, $2) WHERE id = $1 AND $2 = ANY(recovery_hashes)", [u.id, h]);
      if (!rowCount) { await fail(u, step === null ? "code" : "replay", req); return reply.code(401).send({ error: GENERIC }); }
      used = "recovery";
    }
    await pool.query("UPDATE admin_users SET failed_attempts = 0, locked_until = NULL, last_login_at = now() WHERE id = $1", [u.id]);
    await audit(req, "login.ok", { method: used }, u);
    const left = used === "recovery" ? (await load(u.id))!.recovery_hashes.length : undefined;
    return { token: sessionToken(u), admin: { email: u.email, name: u.name, role: u.role }, ...(left !== undefined ? { recoveryCodesLeft: left } : {}) };
  });

  // Step 2b (first login): get a QR code for the authenticator app …
  app.post("/admin/auth/enroll/start", limit(10), async (req, reply) => {
    const body = z.object({ challenge: z.string().min(10) }).safeParse(req.body);
    const claims = body.success ? verifyToken<{ typ: string; sub: number; stage: string }>(body.data.challenge) : null;
    if (!claims || claims.typ !== "admin-challenge" || claims.stage !== "enroll") return reply.code(401).send({ error: "Innloggingen er utløpt. Start på nytt." });
    const u = await load(claims.sub);
    if (!u || u.disabled || u.totp_enabled) return reply.code(401).send({ error: GENERIC });
    const secret = newSecret();
    await pool.query("UPDATE admin_users SET totp_secret_enc = $2 WHERE id = $1", [u.id, encryptSecret(secret)]);
    const uri = otpauthUri(u.email, secret);
    return { secret, otpauthUri: uri, qrSvg: await QRCode.toString(uri, { type: "svg", margin: 1, width: 220 }) };
  });

  // … and confirm with the first code. Returns the session and the one-time recovery codes.
  app.post("/admin/auth/enroll/finish", limit(10), async (req, reply) => {
    const body = z.object({ challenge: z.string().min(10), code: z.string().trim().min(6).max(10) }).safeParse(req.body);
    const claims = body.success ? verifyToken<{ typ: string; sub: number; stage: string }>(body.data.challenge) : null;
    if (!body.success || !claims || claims.typ !== "admin-challenge" || claims.stage !== "enroll") return reply.code(401).send({ error: "Innloggingen er utløpt. Start på nytt." });
    const u = await load(claims.sub);
    if (!u || u.disabled || u.totp_enabled || !u.totp_secret_enc) return reply.code(401).send({ error: GENERIC });
    if (u.locked_until && new Date(u.locked_until) > new Date()) return reply.code(429).send({ error: `For mange forsøk. Kontoen er låst i ${LOCK_MINUTES} minutter.` });
    const step = verifyCode(decryptSecret(u.totp_secret_enc), body.data.code);
    if (step === null) { await fail(u, "enroll-code", req); return reply.code(401).send({ error: "Koden stemmer ikke. Sjekk at klokka på telefonen er riktig, og prøv igjen." }); }
    const rc = newRecoveryCodes();
    await pool.query("UPDATE admin_users SET totp_enabled = true, totp_last_step = $2, recovery_hashes = $3, failed_attempts = 0, locked_until = NULL, last_login_at = now() WHERE id = $1", [u.id, step, rc.hashes]);
    await audit(req, "2fa.enabled", {}, u);
    return { token: sessionToken(u), admin: { email: u.email, name: u.name, role: u.role }, recoveryCodes: rc.plain };
  });

  // Invitation / password-reset link → choose a password.
  app.post("/admin/auth/activate", limit(10), async (req, reply) => {
    const body = z.object({ token: z.string().min(20).max(100), password: z.string().max(200) }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "Bad request" });
    const { rows: [t] } = await pool.query(
      `SELECT t.id, u.id AS uid, u.email, u.disabled FROM admin_tokens t JOIN admin_users u ON u.id = t.admin_id WHERE t.token_hash = $1 AND t.used_at IS NULL AND t.expires_at > now()`, [sha256(body.data.token)]);
    if (!t || t.disabled) return reply.code(400).send({ error: "Lenken er ugyldig eller utløpt. Be en eier om en ny." });
    const problem = passwordProblem(body.data.password, t.email);
    if (problem) return reply.code(400).send({ error: problem });
    await pool.query("UPDATE admin_users SET password_hash = $2, session_version = session_version + 1, failed_attempts = 0, locked_until = NULL WHERE id = $1", [t.uid, await hashPassword(body.data.password)]);
    await pool.query("UPDATE admin_tokens SET used_at = now() WHERE admin_id = $1 AND used_at IS NULL", [t.uid]);
    await audit(req, "password.set", {}, { id: t.uid, email: t.email });
    return { ok: true };
  });

  // ── with a session ──
  app.get("/admin/auth/me", async (req, reply) => {
    const a = await currentAdmin(req);
    return a ? { email: a.email, name: a.name, role: a.role } : reply.code(401).send({ error: "Unauthorized" });
  });

  app.post("/admin/auth/change-password", limit(5), async (req, reply) => {
    const a = await currentAdmin(req);
    if (!a) return reply.code(401).send({ error: "Unauthorized" });
    const body = z.object({ current: z.string().max(200), next: z.string().max(200) }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "Bad request" });
    const u = (await load(a.id))!;
    if (!(await verifyPassword(body.data.current, u.password_hash))) { await fail(u, "change-password", req); return reply.code(401).send({ error: "Nåværende passord stemmer ikke." }); }
    const problem = passwordProblem(body.data.next, u.email);
    if (problem) return reply.code(400).send({ error: problem });
    const { rows: [n] } = await pool.query("UPDATE admin_users SET password_hash = $2, session_version = session_version + 1 WHERE id = $1 RETURNING id, role, session_version", [u.id, await hashPassword(body.data.next)]);
    await audit(req, "password.changed", {}, u);
    return { ok: true, token: sessionToken(n) }; // other sessions are signed out, this one continues
  });
}
