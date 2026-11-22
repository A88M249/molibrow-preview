import { createHash } from "node:crypto";
import { config } from "./config.js";
import { pool } from "./db.js";
import { sendMail } from "./mail.js";
import { CsvError, parseStockCsv } from "./stock-csv.js";

export type Change = { sku: string; name: string; size: string | null; from: number; to: number };
export type Diff = { changes: Change[]; totalBefore: number; totalAfter: number; unmatched: string[]; matched: number; missingZeroed: number };

const normSku = (s: string) => s.trim().toUpperCase().replace(/\s+/g, "");
const stripZeros = (s: string) => normSku(s).replace(/^0+(?=.)/, ""); // Excel often drops leading zeros: "082699" → "82699"

/** Maps the file's SKUs to ours: exact first, then ignoring case/spaces/leading zeros (only when unambiguous). */
async function matchSkus(rows: { sku: string; qty: number }[]) {
  const { rows: prods } = await pool.query("SELECT sku FROM products WHERE active");
  const exact = new Map<string, string>(prods.map((p) => [normSku(p.sku), p.sku]));
  const loose = new Map<string, string[]>();
  for (const p of prods) { const k = stripZeros(p.sku); loose.set(k, [...(loose.get(k) ?? []), p.sku]); }
  const parsed: Record<string, number> = {};
  const unmatched: string[] = [];
  for (const r of rows) {
    const hit = exact.get(normSku(r.sku)) ?? (loose.get(stripZeros(r.sku))?.length === 1 ? loose.get(stripZeros(r.sku))![0] : undefined);
    if (hit) parsed[hit] = (parsed[hit] ?? 0) + r.qty; else unmatched.push(r.sku);
  }
  return { parsed, unmatched };
}

/** Units sold through the shop since the file was sent: the file cannot know about them yet. */
async function openUnitsSince(asOf: Date): Promise<Map<string, number>> {
  const { rows } = await pool.query(
    `SELECT p.sku, SUM(x.q)::int AS units FROM (
       SELECT oi.product_id, oi.quantity AS q FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.status = 'paid' AND o.created_at > $1
       UNION ALL
       SELECT bi.product_id, bi.quantity FROM b2b_order_items bi JOIN b2b_orders bo ON bo.id = bi.order_id WHERE bo.status IN ('placed','confirmed') AND bo.created_at > $1
     ) x JOIN products p ON p.id = x.product_id GROUP BY p.sku`, [asOf]);
  return new Map(rows.map((r) => [r.sku, r.units]));
}

/** What applying this file would do to the current stock. Pure read. */
export async function diffFor(parsed: Record<string, number>, unmatched: string[], asOf: Date): Promise<Diff> {
  const { rows } = await pool.query("SELECT sku, name, size, stock FROM products WHERE active");
  const open = await openUnitsSince(asOf);
  const inFile = new Set(Object.keys(parsed));
  const changes: Change[] = [];
  let totalBefore = 0, totalAfter = 0, missingZeroed = 0;
  for (const p of rows) {
    const wanted = inFile.has(p.sku) ? Math.max(0, parsed[p.sku] - (open.get(p.sku) ?? 0)) : config.stock.missing === "zero" ? 0 : p.stock;
    if (!inFile.has(p.sku) && config.stock.missing === "zero" && p.stock !== 0) missingZeroed++;
    totalBefore += p.stock; totalAfter += wanted;
    if (wanted !== p.stock) changes.push({ sku: p.sku, name: p.name, size: p.size, from: p.stock, to: wanted });
  }
  return { changes, totalBefore, totalAfter, unmatched, matched: inFile.size, missingZeroed };
}

/** A file that would remove most of the stock is held for a human to look at. */
export function safetyProblem(d: Diff, activeProducts: number): string | null {
  if (d.matched === 0) return "Ingen SKU i filen passer med produktene.";
  if (d.totalBefore > 0 && d.totalAfter < d.totalBefore * (1 - config.stock.maxDropPct / 100)) return `Totalt lager ville falle fra ${d.totalBefore} til ${d.totalAfter} (mer enn ${config.stock.maxDropPct} %).`;
  if (config.stock.missing === "zero" && d.matched < activeProducts * 0.5) return `Filen dekker bare ${d.matched} av ${activeProducts} produkter, men er satt til å nullstille alle som mangler.`;
  return null;
}

async function activeCount(): Promise<number> {
  return (await pool.query("SELECT count(*)::int AS n FROM products WHERE active")).rows[0].n;
}

export type ImportResult = { id: number; status: "pending" | "applied" | "failed" | "rejected"; message: string; changed: number; matched: number; unmatched: number };

/** Applies an import in one transaction with fresh numbers (stock may have moved since the file arrived). */
export async function applyImport(id: number, by: string, opts: { force?: boolean } = {}): Promise<ImportResult> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows: [imp] } = await client.query("SELECT * FROM stock_imports WHERE id = $1 FOR UPDATE", [id]);
    if (!imp) throw new CsvError("Importen finnes ikke.");
    if (imp.status !== "pending") throw new CsvError(`Importen er allerede ${imp.status}.`);
    const d = await diffFor(imp.parsed, imp.unmatched_skus, new Date(imp.as_of));
    const problem = safetyProblem(d, await activeCount());
    if (problem && !opts.force) { await client.query("ROLLBACK"); return { id, status: "pending", message: problem, changed: d.changes.length, matched: d.matched, unmatched: d.unmatched.length }; }
    for (const c of d.changes) await client.query("UPDATE products SET stock = $2 WHERE sku = $1", [c.sku, c.to]);
    await client.query("UPDATE products SET stock_updated_at = now() WHERE sku = ANY($1)", [Object.keys(imp.parsed)]); // freshness: also for rows that did not change
    const message = `Oppdaterte ${d.changes.length} varianter (${d.matched} funnet i filen${d.unmatched.length ? `, ${d.unmatched.length} ukjente SKU` : ""}).`;
    await client.query("UPDATE stock_imports SET status = 'applied', applied_at = now(), applied_by = $2, changed = $3, message = $4 WHERE id = $1", [id, by, d.changes.length, message]);
    await client.query("COMMIT");
    void triggerDeploy();
    return { id, status: "applied", message, changed: d.changes.length, matched: d.matched, unmatched: d.unmatched.length };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally { client.release(); }
}

export async function rejectImport(id: number, by: string): Promise<boolean> {
  const { rowCount } = await pool.query("UPDATE stock_imports SET status = 'rejected', applied_by = $2, applied_at = now() WHERE id = $1 AND status = 'pending'", [id, by]);
  return Boolean(rowCount);
}

/** Lets the static storefront rebuild so its pre-rendered availability matches. Failure is only logged. */
async function triggerDeploy() {
  if (!config.stock.deployHook) return;
  try { await fetch(config.stock.deployHook, { method: "POST" }); } catch (e) { console.error("deploy hook failed", e); }
}

export function senderAllowed(from: string | undefined): boolean {
  const list = config.stock.allowedSenders;
  if (!list.length || !from) return false;
  const addr = (from.match(/<([^>]+)>/)?.[1] ?? from).trim().toLowerCase();
  return list.some((e) => (e.startsWith("@") ? addr.endsWith(e) : addr === e));
}

/**
 * The whole pipeline for one file: parse → match → diff → store → (apply if allowed and safe) → notify.
 * Never throws for bad files: they are stored as "failed" with a readable message.
 */
export async function ingestStockFile(input: { content: Buffer; filename?: string; source: "email" | "upload"; sender?: string; asOf?: Date; autoApply?: boolean }): Promise<ImportResult> {
  const checksum = createHash("sha256").update(input.content).digest("hex");
  const asOf = input.asOf ?? new Date();
  const base = { as_of: asOf, source: input.source, sender: input.sender ?? null, filename: input.filename ?? null, checksum };
  let result: ImportResult;
  try {
    const file = parseStockCsv(input.content, { skuColumn: config.stock.skuColumn, qtyColumn: config.stock.qtyColumn });
    const { parsed, unmatched } = await matchSkus(file.rows);
    const d = await diffFor(parsed, unmatched, asOf);
    const { rows: [row] } = await pool.query(
      `INSERT INTO stock_imports (as_of, source, sender, filename, checksum, rows_total, matched, unmatched, changed, unmatched_skus, parsed, message)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
      [base.as_of, base.source, base.sender, base.filename, checksum, file.rowsTotal, d.matched, unmatched.length, d.changes.length, unmatched.slice(0, 500), JSON.stringify(parsed),
        `Kolonner: «${file.skuColumn}» / «${file.qtyColumn}», skilletegn «${file.delimiter === "\t" ? "tab" : file.delimiter}». ${file.skipped ? `${file.skipped} rader hoppet over. ` : ""}Venter på godkjenning.`]);
    result = { id: row.id, status: "pending", message: "Venter på godkjenning.", changed: d.changes.length, matched: d.matched, unmatched: unmatched.length };
    const problem = safetyProblem(d, await activeCount());
    if (input.autoApply && !problem) result = await applyImport(row.id, "auto");
    else if (problem) { result.message = `Holdt tilbake: ${problem}`; await pool.query("UPDATE stock_imports SET message = $2 WHERE id = $1", [row.id, result.message]); }
  } catch (e) {
    const message = e instanceof CsvError ? e.message : `Uventet feil: ${(e as Error).message}`;
    const { rows: [row] } = await pool.query(
      `INSERT INTO stock_imports (as_of, source, sender, filename, checksum, status, message) VALUES ($1,$2,$3,$4,$5,'failed',$6) RETURNING id`,
      [base.as_of, base.source, base.sender, base.filename, checksum, message]);
    result = { id: row.id, status: "failed", message, changed: 0, matched: 0, unmatched: 0 };
  }
  const subject = { applied: "Lager oppdatert", pending: "Lagerfil venter på godkjenning", failed: "Lagerfil kunne ikke leses", rejected: "Lagerfil avvist" }[result.status];
  await sendMail(config.stock.notifyEmail, `${subject} (${input.filename ?? "fil"})`, `${result.message}\n\nFil: ${input.filename ?? "-"}\nAvsender: ${input.sender ?? "opplastet"}\n${result.status === "pending" ? `\nGodkjenn i back-office: ${config.siteUrl}/admin (fane «Lagerimport»)\n` : ""}`);
  return result;
}
