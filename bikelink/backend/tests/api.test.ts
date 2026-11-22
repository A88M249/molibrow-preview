// Integration tests against a real Postgres. Skipped unless DATABASE_URL is set.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, describe, test } from "node:test";

// These tests TRUNCATE tables, so they only run against a database whose name contains "test".
const url = process.env.DATABASE_URL && /test/i.test(new URL(process.env.DATABASE_URL).pathname) ? process.env.DATABASE_URL : undefined;
if (process.env.DATABASE_URL && !url) console.warn("Skipping API tests: DATABASE_URL database name must contain 'test'.");
Object.assign(process.env, {
  RATE_LIMIT_MULTIPLIER: "1000", JWT_SECRET: "test-jwt-secret-with-enough-length-1234567890",
  SITE_URL: "http://localhost:3000", STRIPE_SECRET_KEY: "sk_test_x", STRIPE_WEBHOOK_SECRET: "whsec_x",
  VIPPS_BASE_URL: "http://127.0.0.1:9", VIPPS_CLIENT_ID: "x", VIPPS_CLIENT_SECRET: "x", VIPPS_SUBSCRIPTION_KEY: "x", VIPPS_MSN: "x",
});

describe("api", { skip: !url }, () => {
  let app: Awaited<ReturnType<(typeof import("../src/app.js"))["buildApp"]>>;
  let orders: typeof import("../src/orders.js");
  let pool: typeof import("../src/db.js")["pool"];
  let auth: Record<string, string> = {};

  before(async () => {
    ({ pool } = await import("../src/db.js"));
    await pool.query(readFileSync(new URL("../sql/schema.sql", import.meta.url), "utf8"));
    auth = await (await import("./helpers.js")).adminHeaders(pool);
    await pool.query("TRUNCATE order_items, orders, products RESTART IDENTITY CASCADE");
    await pool.query(readFileSync(new URL("../sql/schema.sql", import.meta.url), "utf8"));
    await pool.query(`INSERT INTO products (sku, slug, name, size, price_ore, stock) VALUES
      ('T-S','test-bike','Test Bike','S',1000000,2), ('T-M','test-bike','Test Bike','M',1000000,0)`);
    orders = await import("../src/orders.js");
    app = await (await import("../src/app.js")).buildApp({ logger: false });
  });
  after(async () => { await app.close(); await pool.end(); });

  test("lists products and variants by slug", async () => {
    const all = await app.inject("/products");
    assert.equal(all.json().length, 2);
    const one = await app.inject("/products/test-bike");
    assert.deepEqual(one.json().variants.map((v: { sku: string }) => v.sku), ["T-S", "T-M"]);
    assert.equal((await app.inject("/products/nope")).statusCode, 404);
  });

  test("checkout rejects bad input and unavailable items", async () => {
    const post = (payload: object) => app.inject({ method: "POST", url: "/checkout", payload });
    const base = { provider: "stripe", email: "a@b.no", items: [{ sku: "T-S", quantity: 1 }] };
    assert.equal((await post({ ...base, email: "not-an-email" })).statusCode, 400);
    assert.equal((await post({ ...base, items: [] })).statusCode, 400);
    assert.equal((await post({ ...base, delivery: { method: "dealer" } })).statusCode, 400, "dealer pickup needs dealerId");
    const unknown = await post({ ...base, items: [{ sku: "NOPE", quantity: 1 }] });
    assert.equal(unknown.statusCode, 400); assert.match(unknown.json().error, /not available/);
    const soldOut = await post({ ...base, items: [{ sku: "T-M", quantity: 1 }] });
    assert.match(soldOut.json().error, /Not enough stock/);
    const tooMany = await post({ ...base, items: [{ sku: "T-S", quantity: 3 }] });
    assert.match(tooMany.json().error, /Not enough stock/);
  });

  test("prices come from the database, never the client", async () => {
    const lines = await orders.priceCart([{ sku: "T-S", quantity: 2 }]);
    assert.equal(lines[0].priceOre, 1000000);
    const o = await orders.createOrder("vipps", "a@b.no", lines, { method: "dealer", dealerId: "ladeverket" });
    assert.equal(o.totalOre, 2000000);
    const { rows: [row] } = await pool.query("SELECT delivery_method, dealer_id, status FROM orders WHERE id = $1", [o.id]);
    assert.deepEqual(row, { delivery_method: "dealer", dealer_id: "ladeverket", status: "pending" });
  });

  test("payment confirmation is idempotent and takes stock once", async () => {
    await pool.query("UPDATE products SET stock = 2 WHERE sku = 'T-S'");
    const lines = await orders.priceCart([{ sku: "T-S", quantity: 1 }]);
    const o = await orders.createOrder("stripe", "a@b.no", lines);
    assert.equal(await orders.markPaid(o.id), true);
    assert.equal(await orders.markPaid(o.id), false, "second webhook must be a no-op");
    const { rows: [p] } = await pool.query("SELECT stock FROM products WHERE sku = 'T-S'");
    assert.equal(p.stock, 1);

    const res = await app.inject({ method: "POST", url: `/admin/orders/${o.id}/fulfil`, headers: auth });
    assert.equal(res.statusCode, 200);
    assert.equal((await app.inject({ method: "POST", url: `/admin/orders/${o.id}/fulfil`, headers: auth })).statusCode, 409);
  });

  test("admin API needs a staff session and can set stock", async () => {
    assert.equal((await app.inject("/admin/orders")).statusCode, 401);
    assert.equal((await app.inject({ url: "/admin/orders", headers: { authorization: "Bearer wrong-token!!" } })).statusCode, 401);
    const list = await app.inject({ url: "/admin/orders?status=fulfilled", headers: auth });
    assert.equal(list.statusCode, 200); assert.equal(list.json().length, 1);
    const set = await app.inject({ method: "PUT", url: "/admin/stock/T-M", headers: auth, payload: { stock: 5 } });
    assert.equal(set.statusCode, 200);
    assert.equal((await app.inject({ method: "PUT", url: "/admin/stock/T-M", headers: auth, payload: { stock: -1 } })).statusCode, 400);
    assert.equal((await app.inject({ method: "PUT", url: "/admin/stock/NOPE", headers: auth, payload: { stock: 1 } })).statusCode, 404);
  });

  test("health check reaches the database", async () => {
    assert.deepEqual((await app.inject("/health")).json(), { ok: true });
  });
});
