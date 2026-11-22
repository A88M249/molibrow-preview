import type { FastifyReply, FastifyRequest } from "fastify";
import { config } from "./config.js";
import { signToken, verifyToken } from "./auth.js";
import { pool } from "./db.js";

export type AdminCtx = { id: number; email: string; name: string | null; role: "owner" | "staff" };
declare module "fastify" { interface FastifyRequest { admin?: AdminCtx } }

export const SESSION_SECONDS = 8 * 3600;
export const sessionToken = (u: { id: number; role: string; session_version: number }) => signToken({ typ: "admin", sub: u.id, role: u.role, sv: u.session_version }, SESSION_SECONDS);
export const challengeToken = (id: number, stage: "totp" | "enroll") => signToken({ typ: "admin-challenge", sub: id, stage }, 5 * 60);

/** Passwords for the back-office: long, and not trivially guessable. */
export function passwordProblem(pw: string, email: string): string | null {
  if (pw.length < 12) return "Passordet må ha minst 12 tegn.";
  if (pw.length > 200) return "Passordet er for langt.";
  const local = email.split("@")[0]?.toLowerCase();
  if (local && local.length >= 4 && pw.toLowerCase().includes(local)) return "Passordet kan ikke inneholde e-postadressen din.";
  if (/^(.)\1+$/.test(pw) || ["123456789012", "passwordpassword", "passordpassord", "qwertyuiopas", "bikelink1234"].includes(pw.toLowerCase())) return "Passordet er for enkelt å gjette.";
  return null;
}

/** The signed-in staff member behind a request, or null. Checks the account is still active and the session not revoked. */
export async function currentAdmin(req: FastifyRequest): Promise<AdminCtx | null> {
  if (!config.jwtSecret) return null;
  const claims = verifyToken<{ typ: string; sub: number; sv: number }>((req.headers.authorization ?? "").replace(/^Bearer\s+/i, ""));
  if (!claims || claims.typ !== "admin") return null;
  const { rows: [u] } = await pool.query("SELECT id, email, name, role, disabled, session_version FROM admin_users WHERE id = $1", [claims.sub]);
  if (!u || u.disabled || u.session_version !== claims.sv) return null;
  return { id: u.id, email: u.email, name: u.name, role: u.role };
}

/** Fastify hook: 401 unless a valid staff session is present (and 403 for staff on owner-only routes). */
export function requireAdmin(opts: { owner?: boolean } = {}) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    if (!config.jwtSecret) return reply.code(503).send({ error: "Back-office is not configured" });
    const a = await currentAdmin(req);
    if (!a) return reply.code(401).send({ error: "Unauthorized" });
    if (opts.owner && a.role !== "owner") return reply.code(403).send({ error: "Bare eier kan gjøre dette" });
    req.admin = a;
  };
}

export async function audit(req: FastifyRequest | null, action: string, detail: Record<string, unknown> = {}, who?: { id: number; email: string }) {
  const a = who ?? req?.admin;
  try {
    await pool.query("INSERT INTO admin_audit (admin_id, email, action, detail, ip) VALUES ($1,$2,$3,$4,$5)", [a?.id ?? null, a?.email ?? null, action, JSON.stringify(detail), req?.ip ?? null]);
  } catch (e) { console.error("audit failed", e); } // never block the action itself
}
