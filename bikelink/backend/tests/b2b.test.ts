// B2B portal tests against a real Postgres (database name must contain "test").
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

test("wholesale price: excl. VAT, minus discount, override wins", async () => {
  const { wholesalePrice } = await import("../src/b2b.js");
  assert.equal(wholesalePrice(1250000, 0), 1000000);
  assert.equal(wholesalePrice(1250000, 20), 800000);
  assert.equal(wholesalePrice(1250000, 20, 700000), 700000);
  assert.equal(wholesalePrice(1250000, 20, 0), 0, "a 0 override is a real price");
});

test("organisation number check digit", async () => {
  const { validOrgNr } = await import("../src/routes/b2b.js");
  assert.equal(validOrgNr("935 095 034"), true);
  assert.equal(validOrgNr("935095035"), false);
  assert.equal(validOrgNr("12345"), false);
});

test("tokens: signature, expiry and tampering", async () => {
  const { signToken, verifyToken } = await import("../src/auth.js");
  const t = signToken({ sub: 7 }, 60);
  assert.equal(verifyToken<{ sub: number }>(t)?.sub, 7);
  assert.equal(verifyToken(t.slice(0, -2) + "xx"), null);
  assert.equal(verifyToken(signToken({ sub: 7 }, -1)), null, "expired");
  const [h, , s] = t.split("."); const forged = Buffer.from(JSON.stringify({ sub: 1, exp: 9999999999 })).toString("base64url");
  assert.equal(verifyToken(`${h}.${forged}.${s}`), null, "payload swap");
});

describe("dealer portal", { skip: !url }, () => {
  let app: Awaited<ReturnType<(typeof import("../src/app.js"))["buildApp"]>>;
  let pool: typeof import("../src/db.js")["pool"];
  let admin: Record<string, string> = {};
  const apply = { company: "Syklene AS", orgNr: "935095034", contactName: "Kari Nordmann", email: "kari@syklene.no", phone: "+47 900 00 000", address: "Storgata 1, 0155 Oslo", businessType: "Sykkelbutikk" };
  let token = "", accountId = 0;

  const call = (method: string, path: string, opts: { body?: object; headers?: Record<string, string> } = {}) =>
    app.inject({ method: method as "GET", url: path, payload: opts.body, headers: opts.headers });
  const asDealer = (t = token) => ({ authorization: `Bearer ${t}` });

  async function newDealer(email: string, discount = 0) {
    // inserted directly: /b2b/apply is rate limited (5 per minute) and is already covered by its own test
    const { rows: [a] } = await pool.query(
      `INSERT INTO b2b_accounts (company, org_nr, contact_name, email, phone, address, business_type) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [apply.company, apply.orgNr, apply.contactName, email, apply.phone, apply.address, apply.businessType]);
    const res = await call("POST", `/admin/b2b/accounts/${a.id}/approve`, { body: { discountPct: discount }, headers: admin });
    const t = new URL(res.json().inviteUrl).searchParams.get("token")!;
    await call("POST", "/b2b/activate", { body: { token: t, password: "a-long-password-1" } });
    const login = await call("POST", "/b2b/login", { body: { email, password: "a-long-password-1" } });
    return { id: a.id as number, token: login.json().token as string };
  }

  before(async () => {
    ({ pool } = await import("../src/db.js"));
    await pool.query(readFileSync(new URL("../sql/schema.sql", import.meta.url), "utf8"));
    admin = await (await import("./helpers.js")).adminHeaders(pool);
    await pool.query("TRUNCATE order_items, orders, products, b2b_accounts RESTART IDENTITY CASCADE");
    await pool.query(readFileSync(new URL("../sql/schema.sql", import.meta.url), "utf8"));
    await pool.query(`INSERT INTO products (sku, slug, name, size, price_ore, stock) VALUES
      ('B-S','b-bike','B Bike','S',1250000,3), ('B-M','b-bike','B Bike','M',1250000,1), ('B-L','b-bike','B Bike','L',1250000,0)`);
    app = await (await import("../src/app.js")).buildApp({ logger: false });
  });
  after(async () => { await app.close(); await pool.end(); });

  test("application is validated and duplicates are refused", async () => {
    assert.equal((await call("POST", "/b2b/apply", { body: { ...apply, orgNr: "123456789" } })).statusCode, 400);
    assert.equal((await call("POST", "/b2b/apply", { body: { ...apply, email: "bad" } })).statusCode, 400);
    assert.equal((await call("POST", "/b2b/apply", { body: apply })).statusCode, 201);
    assert.equal((await call("POST", "/b2b/apply", { body: apply })).statusCode, 409);
  });

  test("no login before approval; approval sends an invite; the link works once", async () => {
    assert.equal((await call("POST", "/b2b/login", { body: { email: apply.email, password: "whatever-long-1" } })).statusCode, 401);
    ({ rows: [{ id: accountId }] } = await pool.query("SELECT id FROM b2b_accounts WHERE email = $1", [apply.email]));
    assert.equal((await call("POST", `/admin/b2b/accounts/${accountId}/approve`, { body: { discountPct: 20 } })).statusCode, 401, "admin token needed");
    const res = await call("POST", `/admin/b2b/accounts/${accountId}/approve`, { body: { discountPct: 20 }, headers: admin });
    assert.equal(res.statusCode, 200);
    const t = new URL(res.json().inviteUrl).searchParams.get("token")!;
    assert.equal((await call("POST", "/b2b/activate", { body: { token: t, password: "short" } })).statusCode, 400);
    assert.equal((await call("POST", "/b2b/activate", { body: { token: "x".repeat(43), password: "a-long-password-1" } })).statusCode, 400);
    assert.equal((await call("POST", "/b2b/activate", { body: { token: t, password: "a-long-password-1" } })).statusCode, 200);
    assert.equal((await call("POST", "/b2b/activate", { body: { token: t, password: "another-long-pw-2" } })).statusCode, 400, "single use");
    assert.equal((await call("POST", "/b2b/login", { body: { email: apply.email, password: "wrong-password-1" } })).statusCode, 401);
    const login = await call("POST", "/b2b/login", { body: { email: apply.email, password: "a-long-password-1" } });
    assert.equal(login.statusCode, 200); token = login.json().token;
  });

  test("catalog needs a token and shows the dealer's price and live stock", async () => {
    assert.equal((await call("GET", "/b2b/catalog")).statusCode, 401);
    assert.equal((await call("GET", "/b2b/catalog", { headers: asDealer("garbage") })).statusCode, 401);
    const cat = (await call("GET", "/b2b/catalog", { headers: asDealer() })).json();
    const s = cat.items.find((i: { sku: string }) => i.sku === "B-S");
    assert.equal(s.priceOre, 800000, "12 500 kr incl. VAT → 10 000 excl. → −20 % = 8 000");
    assert.equal(s.retailOre, 1250000); assert.equal(s.stock, 3);
    await call("PUT", "/admin/wholesale-prices", { body: { prices: [{ sku: "B-M", priceOre: 700000 }] }, headers: admin });
    const cat2 = (await call("GET", "/b2b/catalog", { headers: asDealer() })).json();
    assert.equal(cat2.items.find((i: { sku: string }) => i.sku === "B-M").priceOre, 700000);
    assert.equal((await call("PUT", "/admin/wholesale-prices", { body: { prices: [{ sku: "NOPE", priceOre: 1 }] }, headers: admin })).statusCode, 400);
  });

  test("orders reserve stock, refuse overselling, and are private to the dealer", async () => {
    const order = (items: object[], extra: object = {}) => call("POST", "/b2b/orders", { body: { items, ...extra }, headers: asDealer() });
    assert.equal((await order([{ sku: "B-S", quantity: 4 }])).statusCode, 409, "only 3 in stock");
    assert.equal((await order([{ sku: "B-L", quantity: 1 }])).statusCode, 409, "sold out");
    assert.equal((await order([{ sku: "NOPE", quantity: 1 }])).statusCode, 409);
    assert.equal((await order([])).statusCode, 400);
    const ok = await order([{ sku: "B-S", quantity: 2 }, { sku: "B-S", quantity: 1 }], { reference: "PO-1" });
    assert.equal(ok.statusCode, 201); assert.equal(ok.json().subtotalOre, 3 * 800000, "duplicate lines are merged");
    assert.equal((await pool.query("SELECT stock FROM products WHERE sku='B-S'")).rows[0].stock, 0);
    const list = (await call("GET", "/b2b/orders", { headers: asDealer() })).json();
    assert.equal(list.length, 1); assert.equal(list[0].units, 3);
    const detail = await call("GET", `/b2b/orders/${ok.json().id}`, { headers: asDealer() });
    assert.equal(detail.json().items[0].price_ore, 800000);
    const other = await newDealer("annen@butikk.no");
    assert.equal((await call("GET", `/b2b/orders/${ok.json().id}`, { headers: asDealer(other.token) })).statusCode, 404, "other dealers cannot read it");
  });

  test("two dealers ordering the last unit at once: exactly one wins", async () => {
    await pool.query("UPDATE products SET stock = 1 WHERE sku = 'B-M'");
    const other = await newDealer("race@butikk.no");
    const go = (t: string) => call("POST", "/b2b/orders", { body: { items: [{ sku: "B-M", quantity: 1 }] }, headers: asDealer(t) });
    const results = await Promise.all([go(token), go(other.token), go(token), go(other.token)]);
    const codes = results.map((r) => r.statusCode).sort();
    assert.deepEqual(codes, [201, 409, 409, 409]);
    assert.equal((await pool.query("SELECT stock FROM products WHERE sku='B-M'")).rows[0].stock, 0);
  });

  test("staff move orders along; cancelling returns stock; bad transitions are refused", async () => {
    const { rows: [o] } = await pool.query("SELECT id FROM b2b_orders WHERE reference = 'PO-1'");
    const st = (status: string) => call("POST", `/admin/b2b/orders/${o.id}/status`, { body: { status }, headers: admin });
    assert.equal((await st("shipped")).statusCode, 409, "must be confirmed first");
    assert.equal((await st("confirmed")).statusCode, 200);
    assert.equal((await st("cancelled")).statusCode, 200);
    assert.equal((await pool.query("SELECT stock FROM products WHERE sku='B-S'")).rows[0].stock, 3, "stock restored");
    assert.equal((await st("confirmed")).statusCode, 409, "cancelled is final");
    assert.equal((await call("GET", "/admin/b2b/orders?status=cancelled", { headers: admin })).json().length, 1);
  });

  test("forgot-password never reveals whether an email exists; rejected dealers lose access at once", async () => {
    assert.equal((await call("POST", "/b2b/forgot", { body: { email: "ukjent@ingen.no" } })).statusCode, 200);
    assert.equal((await call("POST", "/b2b/forgot", { body: { email: apply.email } })).statusCode, 200);
    assert.equal((await call("GET", "/b2b/me", { headers: asDealer() })).statusCode, 200);
    await call("POST", `/admin/b2b/accounts/${accountId}/reject`, { headers: admin });
    assert.equal((await call("GET", "/b2b/me", { headers: asDealer() })).statusCode, 401, "old token no longer works");
    assert.equal((await call("POST", "/b2b/login", { body: { email: apply.email, password: "a-long-password-1" } })).statusCode, 401);
  });
});
