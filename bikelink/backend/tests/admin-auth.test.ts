import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, describe, test } from "node:test";

const url = process.env.DATABASE_URL && /test/i.test(new URL(process.env.DATABASE_URL).pathname) ? process.env.DATABASE_URL : undefined;
Object.assign(process.env, {
  RATE_LIMIT_MULTIPLIER: "1000",
  SITE_URL: "http://localhost:3000", STRIPE_SECRET_KEY: "sk_test_x", STRIPE_WEBHOOK_SECRET: "whsec_x",
  VIPPS_BASE_URL: "http://127.0.0.1:9", VIPPS_CLIENT_ID: "x", VIPPS_CLIENT_SECRET: "x", VIPPS_SUBSCRIPTION_KEY: "x", VIPPS_MSN: "x",
  JWT_SECRET: "test-jwt-secret-with-enough-length-1234567890",
});

describe("back-office login: password + authenticator app", { skip: !url }, () => {
  let app: Awaited<ReturnType<(typeof import("../src/app.js"))["buildApp"]>>;
  let pool: typeof import("../src/db.js")["pool"];
  let totp: typeof import("../src/totp.js");
  const PW = "correct horse battery 1";

  const call = (method: string, path: string, body?: object, headers?: Record<string, string>) => app.inject({ method: method as "GET", url: path, payload: body, headers });
  const bearer = (t: string) => ({ authorization: `Bearer ${t}` });
  /** Rolling forward step so successive codes in one test are never a replay. */
  let nextStep = 0;
  const freshCode = (secret: string) => { nextStep = Math.max(nextStep + 1, totp.stepAt(Date.now())); return totp.codeFor(secret, Math.min(nextStep, totp.stepAt(Date.now()) + 1)); };

  async function makeUser(email: string, role: "owner" | "staff" = "owner", enrolled = false) {
    const { hashPassword } = await import("../src/auth.js");
    const secret = totp.newSecret();
    await pool.query(
      `INSERT INTO admin_users (email, role, password_hash, totp_secret_enc, totp_enabled) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (email) DO UPDATE SET role=$2, password_hash=$3, totp_secret_enc=$4, totp_enabled=$5, totp_last_step=0, recovery_hashes='{}', disabled=false, failed_attempts=0, locked_until=NULL`,
      [email, role, await hashPassword(PW), enrolled ? totp.encryptSecret(secret) : null, enrolled]);
    return secret;
  }
  const loginPassword = (email: string, password = PW) => call("POST", "/admin/auth/login", { email, password });

  before(async () => {
    ({ pool } = await import("../src/db.js"));
    await pool.query(readFileSync(new URL("../sql/schema.sql", import.meta.url), "utf8"));
    totp = await import("../src/totp.js");
    await pool.query("TRUNCATE admin_audit, admin_tokens, admin_users RESTART IDENTITY CASCADE");
    app = await (await import("../src/app.js")).buildApp({ logger: false });
  });
  after(async () => { await app.close(); await pool.end(); });

  test("nothing in /admin is reachable without a session; the old shared token is gone", async () => {
    for (const path of ["/admin/orders", "/admin/stock", "/admin/b2b/accounts", "/admin/stock-imports", "/admin/users"]) assert.equal((await call("GET", path)).statusCode, 401, path);
    assert.equal((await call("GET", "/admin/orders", undefined, bearer("test-admin-token"))).statusCode, 401);
    assert.equal((await call("GET", "/admin/orders", undefined, bearer("a.b.c"))).statusCode, 401);
  });

  test("first login: password, then set up the authenticator app, then a session and recovery codes", async () => {
    await makeUser("first@bikelink.test");
    const l = await loginPassword("first@bikelink.test");
    assert.equal(l.statusCode, 200); assert.equal(l.json().step, "enroll");
    const { challenge } = l.json();
    assert.equal((await call("POST", "/admin/auth/totp", { challenge, code: "123456" })).statusCode, 401, "an enrol challenge cannot be used as a login");
    const start = (await call("POST", "/admin/auth/enroll/start", { challenge })).json();
    assert.match(start.secret, /^[A-Z2-7]{32}$/); assert.match(start.otpauthUri, /^otpauth:\/\/totp\//); assert.match(start.qrSvg, /^<svg/);
    assert.equal((await call("POST", "/admin/auth/enroll/finish", { challenge, code: "000000" })).statusCode, 401, "wrong code");
    const fin = await call("POST", "/admin/auth/enroll/finish", { challenge, code: totp.codeFor(start.secret, totp.stepAt(Date.now())) });
    assert.equal(fin.statusCode, 200);
    const { token, recoveryCodes } = fin.json();
    assert.equal(recoveryCodes.length, 8);
    assert.equal((await call("GET", "/admin/auth/me", undefined, bearer(token))).json().email, "first@bikelink.test");
    assert.equal((await call("GET", "/admin/orders", undefined, bearer(token))).statusCode, 200);
    const { rows: [u] } = await pool.query("SELECT totp_secret_enc, recovery_hashes FROM admin_users WHERE email='first@bikelink.test'");
    assert.ok(!u.totp_secret_enc.includes(start.secret), "secret is encrypted at rest");
    assert.ok(u.recovery_hashes.every((h: string) => /^[0-9a-f]{64}$/.test(h)) && !recoveryCodes.includes(u.recovery_hashes[0]), "recovery codes are stored hashed");
    assert.equal((await call("POST", "/admin/auth/enroll/start", { challenge })).statusCode, 401, "2FA cannot be re-enrolled with an old challenge");
  });

  test("returning login needs the right password AND a valid code; each code works once", async () => {
    const secret = await makeUser("daily@bikelink.test", "owner", true);
    assert.equal((await loginPassword("daily@bikelink.test", "wrong password here")).statusCode, 401);
    assert.equal((await loginPassword("nobody@bikelink.test")).statusCode, 401, "unknown user looks the same");
    const l = await loginPassword("daily@bikelink.test");
    assert.equal(l.json().step, "totp");
    assert.equal((await call("POST", "/admin/auth/totp", { challenge: l.json().challenge, code: "000000" })).statusCode, 401);
    const code = totp.codeFor(secret, totp.stepAt(Date.now()));
    const ok = await call("POST", "/admin/auth/totp", { challenge: l.json().challenge, code });
    assert.equal(ok.statusCode, 200);
    const again = await loginPassword("daily@bikelink.test");
    assert.equal((await call("POST", "/admin/auth/totp", { challenge: again.json().challenge, code })).statusCode, 401, "same code twice = replay");
    assert.equal((await call("POST", "/admin/auth/totp", { challenge: "garbage-challenge", code })).statusCode, 401);
  });

  test("five wrong attempts lock the account, even for the right password", async () => {
    await makeUser("lock@bikelink.test", "owner", true);
    for (let i = 0; i < 5; i++) assert.equal((await loginPassword("lock@bikelink.test", "nope nope nope nope")).statusCode, 401);
    const locked = await loginPassword("lock@bikelink.test");
    assert.equal(locked.statusCode, 429); assert.match(locked.json().error, /låst/);
    const owner = await (await import("./helpers.js")).adminHeaders(pool);
    const { rows: [u] } = await pool.query("SELECT id FROM admin_users WHERE email='lock@bikelink.test'");
    assert.equal((await call("POST", `/admin/users/${u.id}/unlock`, {}, owner)).statusCode, 200);
    assert.equal((await loginPassword("lock@bikelink.test")).statusCode, 200);
  });

  test("a recovery code replaces the authenticator once", async () => {
    const secret = await makeUser("rec@bikelink.test", "owner", true);
    const rc = totp.newRecoveryCodes(2);
    await pool.query("UPDATE admin_users SET recovery_hashes = $2 WHERE email = $1", ["rec@bikelink.test", rc.hashes]);
    const l = await loginPassword("rec@bikelink.test");
    const ok = await call("POST", "/admin/auth/totp", { challenge: l.json().challenge, code: rc.plain[0].toUpperCase() });
    assert.equal(ok.statusCode, 200); assert.equal(ok.json().recoveryCodesLeft, 1);
    const l2 = await loginPassword("rec@bikelink.test");
    assert.equal((await call("POST", "/admin/auth/totp", { challenge: l2.json().challenge, code: rc.plain[0] })).statusCode, 401, "already used");
    assert.ok(secret);
  });

  test("owner invites staff; the invite link works once; staff cannot manage users", async () => {
    const owner = await (await import("./helpers.js")).adminHeaders(pool);
    const inv = await call("POST", "/admin/users", { email: "Staff@BikeLink.test", name: "Stine", role: "staff" }, owner);
    assert.equal(inv.statusCode, 201);
    assert.equal((await call("POST", "/admin/users", { email: "staff@bikelink.test" }, owner)).statusCode, 409);
    const t = new URL(inv.json().inviteUrl).searchParams.get("token")!;
    assert.equal((await loginPassword("staff@bikelink.test")).statusCode, 401, "no password yet");
    assert.equal((await call("POST", "/admin/auth/activate", { token: t, password: "short" })).statusCode, 400);
    assert.equal((await call("POST", "/admin/auth/activate", { token: t, password: "staff-staff-staff" })).statusCode, 400, "contains the email name");
    assert.equal((await call("POST", "/admin/auth/activate", { token: t, password: "Sunny-days-in-Oslo-42" })).statusCode, 200);
    assert.equal((await call("POST", "/admin/auth/activate", { token: t, password: "Another-long-pass-99" })).statusCode, 400, "single use");
    const l = await loginPassword("staff@bikelink.test", "Sunny-days-in-Oslo-42");
    assert.equal(l.json().step, "enroll");
    const start = (await call("POST", "/admin/auth/enroll/start", { challenge: l.json().challenge })).json();
    const fin = (await call("POST", "/admin/auth/enroll/finish", { challenge: l.json().challenge, code: totp.codeFor(start.secret, totp.stepAt(Date.now())) })).json();
    assert.equal((await call("GET", "/admin/orders", undefined, bearer(fin.token))).statusCode, 200, "staff can work");
    assert.equal((await call("GET", "/admin/users", undefined, bearer(fin.token))).statusCode, 403, "but not manage users");
    assert.equal((await call("GET", "/admin/audit", undefined, bearer(fin.token))).statusCode, 403);
  });

  test("disabling a user or resetting 2FA signs them out immediately; the last owner is protected", async () => {
    const owner = await (await import("./helpers.js")).adminHeaders(pool);
    await makeUser("gone@bikelink.test", "staff", true);
    const { sessionToken } = await import("../src/admin-auth.js");
    const { rows: [g] } = await pool.query("SELECT id, role, session_version FROM admin_users WHERE email='gone@bikelink.test'");
    const tok = sessionToken(g);
    assert.equal((await call("GET", "/admin/orders", undefined, bearer(tok))).statusCode, 200);
    assert.equal((await call("POST", `/admin/users/${g.id}/reset-2fa`, {}, owner)).statusCode, 200);
    assert.equal((await call("GET", "/admin/orders", undefined, bearer(tok))).statusCode, 401, "old session dead after 2FA reset");
    assert.equal((await loginPassword("gone@bikelink.test")).json().step, "enroll", "must set up 2FA again");
    assert.equal((await call("POST", `/admin/users/${g.id}/disable`, {}, owner)).statusCode, 200);
    assert.equal((await loginPassword("gone@bikelink.test")).statusCode, 401, "disabled");
    const { rows: [me] } = await pool.query("SELECT id FROM admin_users WHERE email='owner@bikelink.test'");
    assert.equal((await call("POST", `/admin/users/${me.id}/disable`, {}, owner)).statusCode, 409, "not yourself");
  });

  test("changing the password signs other sessions out and keeps this one", async () => {
    await makeUser("chg@bikelink.test", "owner", true);
    const { sessionToken } = await import("../src/admin-auth.js");
    const { rows: [u] } = await pool.query("SELECT id, role, session_version FROM admin_users WHERE email='chg@bikelink.test'");
    const old = sessionToken(u);
    assert.equal((await call("POST", "/admin/auth/change-password", { current: "wrong password!!", next: "A-brand-new-password-7" }, bearer(old))).statusCode, 401);
    assert.equal((await call("POST", "/admin/auth/change-password", { current: PW, next: "short" }, bearer(old))).statusCode, 400);
    const r = await call("POST", "/admin/auth/change-password", { current: PW, next: "A-brand-new-password-7" }, bearer(old));
    assert.equal(r.statusCode, 200);
    assert.equal((await call("GET", "/admin/orders", undefined, bearer(old))).statusCode, 401);
    assert.equal((await call("GET", "/admin/orders", undefined, bearer(r.json().token))).statusCode, 200);
    assert.equal((await loginPassword("chg@bikelink.test", "A-brand-new-password-7")).statusCode, 200);
  });

  test("sensitive actions and failed logins are written to the audit log", async () => {
    const owner = await (await import("./helpers.js")).adminHeaders(pool);
    const log = (await call("GET", "/admin/audit", undefined, owner)).json() as { action: string; email: string | null }[];
    const actions = new Set(log.map((l) => l.action));
    for (const a of ["login.failed", "login.ok", "2fa.enabled", "user.invited", "password.set", "user.disabled"]) assert.ok(actions.has(a), a);
    assert.ok(!JSON.stringify(log).includes(PW), "no passwords in the log");
  });
});
