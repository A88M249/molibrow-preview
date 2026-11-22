import { hashPassword } from "../src/auth.js";
import { sessionToken } from "../src/admin-auth.js";
import { encryptSecret, newSecret } from "../src/totp.js";
import type { Pool } from "pg";

/** A signed-in back-office owner for tests that are not about logging in (a real account row + a real session token). */
export async function adminHeaders(pool: Pool, email = "owner@bikelink.test", role: "owner" | "staff" = "owner"): Promise<Record<string, string>> {
  const { rows: [u] } = await pool.query(
    `INSERT INTO admin_users (email, role, password_hash, totp_secret_enc, totp_enabled) VALUES ($1,$2,$3,$4,true)
     ON CONFLICT (email) DO UPDATE SET role = $2, disabled = false RETURNING id, role, session_version`,
    [email, role, await hashPassword("a-test-password-123"), encryptSecret(newSecret())]);
  return { authorization: `Bearer ${sessionToken(u)}` };
}
