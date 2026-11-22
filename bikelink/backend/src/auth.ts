import { createHash, createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { config } from "./config.js";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

/** scrypt$<salt hex>$<hash hex> */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  // Always do the work, even for unknown accounts, so response time does not reveal whether an email exists.
  const [scheme, saltHex, hashHex] = (stored ?? "scrypt$00$00").split("$");
  const salt = Buffer.from(saltHex ?? "00", "hex");
  const expected = Buffer.from(hashHex ?? "00", "hex");
  const actual = await scrypt(password, salt, expected.length || 64);
  return scheme === "scrypt" && stored !== null && actual.length === expected.length && timingSafeEqual(actual, expected);
}

const b64 = (b: Buffer | string) => Buffer.from(b).toString("base64url");

/** Minimal HS256 JWT. */
export function signToken(payload: Record<string, unknown>, ttlSeconds: number): string {
  if (!config.jwtSecret) throw new Error("JWT_SECRET not set");
  const head = b64(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds }));
  const sig = createHmac("sha256", config.jwtSecret).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
}

export function verifyToken<T extends Record<string, unknown>>(token: string): (T & { exp: number }) | null {
  if (!config.jwtSecret) return null;
  const [head, body, sig] = token.split(".");
  if (!head || !body || !sig) return null;
  const expected = createHmac("sha256", config.jwtSecret).update(`${head}.${body}`).digest();
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString());
    return typeof payload.exp === "number" && payload.exp > Date.now() / 1000 ? payload : null;
  } catch { return null; }
}

/** Random one-time token: the plain value goes to the user, only its hash is stored. */
export function newOneTimeToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: sha256(token) };
}
export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
