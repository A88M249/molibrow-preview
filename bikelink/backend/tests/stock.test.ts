import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, describe, test } from "node:test";

const url = process.env.DATABASE_URL && /test/i.test(new URL(process.env.DATABASE_URL).pathname) ? process.env.DATABASE_URL : undefined;
Object.assign(process.env, {
  RATE_LIMIT_MULTIPLIER: "1000",
  SITE_URL: "http://localhost:3000", STRIPE_SECRET_KEY: "sk_test_x", STRIPE_WEBHOOK_SECRET: "whsec_x",
  VIPPS_BASE_URL: "http://127.0.0.1:9", VIPPS_CLIENT_ID: "x", VIPPS_CLIENT_SECRET: "x", VIPPS_SUBSCRIPTION_KEY: "x", VIPPS_MSN: "x",
  JWT_SECRET: "test-jwt-secret-with-enough-length-1234567890",
  STOCK_INGEST_TOKEN: "test-ingest-token", STOCK_ALLOWED_SENDERS: "stock@mmrbikes.test, @mmr-office.test",
});

const latin1 = (s: string) => Buffer.from(s, "latin1");

describe("CSV parsing", () => {
  test("Spanish export: semicolons, Windows-1252, header names in Spanish", async () => {
    const { parseStockCsv } = await import("../src/stock-csv.js");
    const r = parseStockCsv(latin1("Referencia;Descripción;Stock disponible\r\n081908;AELION 00 XS;3\r\n081897;AELION 00 S;0\r\n"));
    assert.deepEqual(r.rows, [{ sku: "081908", qty: 3 }, { sku: "081897", qty: 0 }]);
    assert.equal(r.delimiter, ";"); assert.equal(r.skuColumn, "Referencia"); assert.equal(r.qtyColumn, "Stock disponible");
  });

  test("comma CSV with BOM, quotes, commas and newlines inside quoted fields", async () => {
    const { parseStockCsv } = await import("../src/stock-csv.js");
    const csv = '﻿"SKU","Name","Qty"\n"A1","Bike, with comma",4\n"A2","Two\nlines ""quoted""",7\n';
    assert.deepEqual(parseStockCsv(Buffer.from(csv)).rows, [{ sku: "A1", qty: 4 }, { sku: "A2", qty: 7 }]);
  });

  test("title lines above the header, tab delimiter, duplicates summed, junk rows skipped", async () => {
    const { parseStockCsv } = await import("../src/stock-csv.js");
    const csv = "MMR Bikes stock report\n2026-11-22\n\nSKU\tModel\tAvailable\nA1\tx\t2\nA1\tx\t3\nA2\tx\tn/a\n\tx\t5\nA3\tx\t-4\n";
    const r = parseStockCsv(Buffer.from(csv));
    assert.deepEqual(r.rows, [{ sku: "A1", qty: 5 }, { sku: "A3", qty: 0 }]);
    assert.equal(r.skipped, 2);
  });

  test("quantity formats", async () => {
    const { parseQty } = await import("../src/stock-csv.js");
    for (const [raw, want] of [["12", 12], ["12,0", 12], ["12.0", 12], ["1.234", 1234], ["1 234", 1234], ["1,234.00", 1234], ["1.234,00", 1234], ["0,5", 0], ["-3", 0], ["+10", 10], ["+5", 5], ["abc", null], ["", null]] as const)
      assert.equal(parseQty(raw), want, raw);
  });

  test("clear error when columns are not recognised; override by header name works", async () => {
    const { parseStockCsv, CsvError } = await import("../src/stock-csv.js");
    const odd = "Chave;Quantos\nA1;3\n";
    assert.throws(() => parseStockCsv(Buffer.from(odd)), (e: Error) => e instanceof CsvError && /Chave/.test(e.message) && /Quantos/.test(e.message));
    assert.deepEqual(parseStockCsv(Buffer.from(odd), { skuColumn: "chave", qtyColumn: "QUANTOS" }).rows, [{ sku: "A1", qty: 3 }]);
    assert.throws(() => parseStockCsv(Buffer.from("")), /tom/);
  });
});

describe("email parsing", () => {
  const mime = (from: string, attach: { name: string; type: string; body: string }[]) => [
    `From: "MMR Stock" <${from}>`, "To: stock@bikelink.no", "Subject: Daily stock", "Date: Sat, 21 Nov 2026 06:30:00 +0000", "MIME-Version: 1.0",
    'Content-Type: multipart/mixed; boundary="b1"', "", "--b1", "Content-Type: text/plain; charset=utf-8", "", "Hi, stock attached.", ...attach.flatMap((a) => [
      "--b1", `Content-Type: ${a.type}; name="${a.name}"`, `Content-Disposition: attachment; filename="${a.name}"`, "Content-Transfer-Encoding: base64", "", Buffer.from(a.body, "latin1").toString("base64")]), "--b1--", ""].join("\r\n");

  test("finds the CSV attachment, sender and date; ignores other attachments", async () => {
    const { csvAttachmentsFrom } = await import("../src/stock-mail.js");
    const m = await csvAttachmentsFrom(Buffer.from(mime("stock@mmrbikes.test", [{ name: "stock_2026-11-21.csv", type: "text/csv", body: "Referencia;Stock\n081908;3\n" }, { name: "logo.png", type: "image/png", body: "x" }, { name: "stock.xlsx", type: "application/vnd.ms-excel", body: "x" }])));
    assert.equal(m.from, "stock@mmrbikes.test"); assert.equal(m.date?.toISOString(), "2026-11-21T06:30:00.000Z");
    assert.deepEqual(m.files.map((f) => f.filename), ["stock_2026-11-21.csv"]);
    assert.match(m.files[0].content.toString("latin1"), /081908;3/);
  });

  test("CSV sent with a generic content type is still recognised by its file name", async () => {
    const { csvAttachmentsFrom } = await import("../src/stock-mail.js");
    const m = await csvAttachmentsFrom(Buffer.from(mime("a@b.test", [{ name: "Lager.CSV", type: "application/octet-stream", body: "SKU;Stock\nA;1\n" }])));
    assert.equal(m.files.length, 1);
  });
});

describe("MMR's real export (Disponibilidad productos)", () => {
  const fixture = () => readFileSync(new URL("./fixtures/mmr-disponibilidad.csv", import.meta.url));

  test("columns, Windows-1252, quoted fields, and +10 (= 10 or more) are all understood", async () => {
    const { parseStockCsv } = await import("../src/stock-csv.js");
    const r = parseStockCsv(fixture());
    assert.equal(r.delimiter, ";"); assert.equal(r.skuColumn, "Cod. Artículo");
    assert.equal(r.qtyColumn, "Disponible inmediato", "must not pick 'Disponible próximamente' (arriving later)");
    assert.equal(r.skipped, 0);
    const by = new Map(r.rows.map((x) => [x.sku, x.qty]));
    assert.equal(by.get("064805"), 10, "+10");
    assert.equal(by.get("082699"), 3);
    assert.equal(by.get("082705"), 0, "a listed row with 0 is real information");
    assert.equal(by.get("075021"), 10);
  });
});

describe("stock sync", { skip: !url }, () => {
  let app: Awaited<ReturnType<(typeof import("../src/app.js"))["buildApp"]>>;
  let pool: typeof import("../src/db.js")["pool"];
  let imp: typeof import("../src/stock-import.js");
  let config: typeof import("../src/config.js")["config"];
  let admin: Record<string, string> = {};
  const stock = async (sku: string) => (await pool.query("SELECT stock FROM products WHERE sku = $1", [sku])).rows[0].stock as number;
  const reset = async () => {
    config.stock.missing = "keep"; // most tests assume untouched SKUs; the "zero" behaviour has its own test
    await pool.query("TRUNCATE order_items, orders, b2b_order_items, b2b_orders, b2b_accounts, stock_imports, products RESTART IDENTITY CASCADE");
    await pool.query(`INSERT INTO products (sku, slug, name, size, price_ore, stock, active) VALUES
      ('082699','bike-a','Bike A','S',1000000,5,true), ('080755','bike-b','Bike B','M',1000000,2,true), ('081000','bike-c','Bike C','L',1000000,0,true), ('999999','old','Old','M',1,9,false)`);
  };

  before(async () => {
    ({ pool } = await import("../src/db.js"));
    await pool.query(readFileSync(new URL("../sql/schema.sql", import.meta.url), "utf8"));
    admin = await (await import("./helpers.js")).adminHeaders(pool);
    ({ config } = await import("../src/config.js"));
    await pool.query(readFileSync(new URL("../sql/schema.sql", import.meta.url), "utf8"));
    imp = await import("../src/stock-import.js");
    app = await (await import("../src/app.js")).buildApp({ logger: false });
  });
  after(async () => { await app.close(); await pool.end(); });

  test("matches SKUs even when Excel dropped the leading zero; unknown and inactive SKUs are reported", async () => {
    await reset();
    const r = await imp.ingestStockFile({ content: Buffer.from("SKU;Stock\n82699;3\n080755;10\nXYZ;1\n999999;4\n"), source: "upload", filename: "mmr.csv" });
    assert.equal(r.status, "pending"); assert.equal(r.matched, 2); assert.equal(r.unmatched, 2); assert.equal(r.changed, 2);
    assert.equal(await stock("082699"), 5, "nothing changes before approval");
    const a = await imp.applyImport(r.id, "admin");
    assert.equal(a.status, "applied");
    assert.equal(await stock("082699"), 3); assert.equal(await stock("080755"), 10); assert.equal(await stock("081000"), 0, "SKUs not in the file keep their stock");
    assert.equal(await stock("999999"), 9, "inactive product untouched");
    assert.ok((await pool.query("SELECT stock_updated_at FROM products WHERE sku='082699'")).rows[0].stock_updated_at);
    await assert.rejects(imp.applyImport(r.id, "admin"), /allerede applied/);
  });

  test("orders placed after the file was sent are subtracted (the file cannot know about them)", async () => {
    await reset();
    const asOf = new Date(Date.now() - 3600_000);
    const [{ id: pid }] = (await pool.query("SELECT id FROM products WHERE sku='082699'")).rows;
    const { rows: [o] } = await pool.query("INSERT INTO orders (status, provider, email, total_ore) VALUES ('paid','stripe','a@b.no',1) RETURNING id");
    await pool.query("INSERT INTO order_items (order_id, product_id, quantity, price_ore) VALUES ($1,$2,1,1)", [o.id, pid]);
    const { rows: [acc] } = await pool.query("INSERT INTO b2b_accounts (company, org_nr, contact_name, email, phone, address, business_type, status) VALUES ('X','935095034','K','k@x.no','1','a','b','approved') RETURNING id");
    const { rows: [bo] } = await pool.query("INSERT INTO b2b_orders (account_id, delivery_address, subtotal_ore) VALUES ($1,'a',1) RETURNING id", [acc.id]);
    await pool.query("INSERT INTO b2b_order_items (order_id, product_id, quantity, price_ore) VALUES ($1,$2,2,1)", [bo.id, pid]);
    const r = await imp.ingestStockFile({ content: Buffer.from("SKU;Stock\n082699;10\n"), source: "upload", asOf, autoApply: true });
    assert.equal(r.status, "applied");
    assert.equal(await stock("082699"), 7, "10 in the file − 1 web order − 2 dealer units");
    const older = await imp.ingestStockFile({ content: Buffer.from("SKU;Stock\n082699;10\n"), source: "upload", asOf: new Date(Date.now() + 60_000), autoApply: true });
    assert.equal(await stock("082699"), 10, "orders from before the file date are already in it");
    assert.equal(older.status, "applied");
  });

  test("a file that would wipe the stock is held; only an explicit force applies it", async () => {
    await reset();
    const r = await imp.ingestStockFile({ content: Buffer.from("SKU;Stock\n082699;0\n080755;0\n"), source: "upload", autoApply: true });
    assert.equal(r.status, "pending", "auto-apply must not bypass the safety check");
    assert.match(r.message, /falle fra 7 til 0/);
    assert.equal(await stock("082699"), 5);
    const still = await imp.applyImport(r.id, "admin");
    assert.equal(still.status, "pending");
    assert.equal((await imp.applyImport(r.id, "admin", { force: true })).status, "applied");
    assert.equal(await stock("082699"), 0);
  });

  test("STOCK_MISSING=zero clears SKUs that are absent – but only for files that cover most products", async () => {
    await reset();
    config.stock.missing = "zero";
    try {
      const partial = await imp.ingestStockFile({ content: Buffer.from("SKU;Stock\n082699;5\n"), source: "upload", autoApply: true });
      assert.equal(partial.status, "pending"); assert.match(partial.message, /bare 1 av 3/);
      const full = await imp.ingestStockFile({ content: Buffer.from("SKU;Stock\n082699;5\n080755;2\n"), source: "upload", autoApply: true });
      assert.equal(full.status, "applied");
    } finally { config.stock.missing = "keep"; }
  });

  test("unreadable files are recorded as failed with a readable reason", async () => {
    await reset();
    const r = await imp.ingestStockFile({ content: Buffer.from("hello;world\nnothing;useful\n"), source: "upload", filename: "x.csv" });
    assert.equal(r.status, "failed"); assert.match(r.message, /Fant ikke kolonner/);
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM stock_imports WHERE status='failed'")).rows[0].n, 1);
  });

  test("email intake endpoint: token, sender allow-list, display names, bad files", async () => {
    await reset();
    const csv = Buffer.from("SKU;Stock\n082699;8\n").toString("base64");
    const post = (body: object, token = "test-ingest-token") => app.inject({ method: "POST", url: "/ingest/stock", payload: body, headers: { authorization: `Bearer ${token}` } });
    assert.equal((await post({ from: "stock@mmrbikes.test", csvBase64: csv }, "wrong-token-value!!")).statusCode, 401);
    assert.equal((await post({ from: "evil@spam.test", csvBase64: csv })).statusCode, 403);
    assert.equal((await post({ from: "x@y.test", csvBase64: csv })).statusCode, 403);
    const ok = await post({ from: '"MMR Stock" <Stock@MMRBikes.test>', filename: "stock.csv", csvBase64: csv });
    assert.equal(ok.statusCode, 202); assert.equal(ok.json().status, "pending", "STOCK_AUTO_APPLY is off by default");
    assert.equal((await post({ from: "anyone@mmr-office.test", csvBase64: csv })).statusCode, 202, "@domain entries work");
    const bad = await post({ from: "stock@mmrbikes.test", csvBase64: Buffer.from("nope").toString("base64") });
    assert.equal(bad.statusCode, 422);
    assert.equal((await app.inject({ method: "POST", url: "/ingest/stock", payload: { from: "stock@mmrbikes.test", csvBase64: csv } })).statusCode, 401, "no token");
  });

  test("auto-apply switched on: a good email file updates stock by itself", async () => {
    await reset();
    config.stock.autoApply = true;
    try {
      const r = await app.inject({ method: "POST", url: "/ingest/stock", headers: { authorization: "Bearer test-ingest-token" }, payload: { from: "stock@mmrbikes.test", csvBase64: Buffer.from("SKU;Stock\n082699;4\n080755;3\n").toString("base64") } });
      assert.equal(r.json().status, "applied"); assert.equal(await stock("082699"), 4);
    } finally { config.stock.autoApply = false; }
  });

  test("admin can list, preview, upload, apply and reject", async () => {
    await reset();
    assert.equal((await app.inject("/admin/stock-imports")).statusCode, 401);
    const up = await app.inject({ method: "POST", url: "/admin/stock-imports", headers: admin, payload: { filename: "manual.csv", csv: "SKU;Stock\n082699;9\n" } });
    assert.equal(up.statusCode, 201);
    const id = up.json().id;
    const prev = (await app.inject({ url: `/admin/stock-imports/${id}`, headers: admin })).json();
    assert.deepEqual(prev.changes, [{ sku: "082699", name: "Bike A", size: "S", from: 5, to: 9 }]);
    assert.equal((await app.inject({ method: "POST", url: `/admin/stock-imports/${id}/apply`, headers: admin, payload: {} })).json().status, "applied");
    assert.equal((await app.inject({ method: "POST", url: `/admin/stock-imports/${id}/apply`, headers: admin, payload: {} })).statusCode, 409);
    const up2 = await app.inject({ method: "POST", url: "/admin/stock-imports", headers: admin, payload: { csv: "SKU;Stock\n082699;1\n" } });
    assert.equal((await app.inject({ method: "POST", url: `/admin/stock-imports/${up2.json().id}/reject`, headers: admin, payload: {} })).statusCode, 200);
    assert.equal(await stock("082699"), 9, "rejected file changed nothing");
    const list = (await app.inject({ url: "/admin/stock-imports", headers: admin })).json();
    assert.equal(list.autoApply, false); assert.deepEqual(list.imports.map((i: { status: string }) => i.status), ["rejected", "applied"]);
  });

  test("the public product API only reports 10+ instead of exact stock", async () => {
    await reset();
    await pool.query("UPDATE products SET stock = 25 WHERE sku = '082699'");
    const v = (await app.inject("/products/bike-a")).json().variants[0];
    assert.equal(v.stock, 10);
    assert.equal((await app.inject("/products")).json().find((p: { sku: string }) => p.sku === "082699").stock, 10);
  });
});
