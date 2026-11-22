/** Parsing of the stock CSV that MMR sends. No dependencies; tolerant of the usual spreadsheet-export quirks. */

export type ParsedStock = {
  rows: { sku: string; qty: number }[];   // one entry per distinct SKU (duplicates summed)
  rowsTotal: number;                       // data rows read
  skipped: number;                         // rows without a usable SKU or quantity
  delimiter: string;
  skuColumn: string;
  qtyColumn: string;
};

export class CsvError extends Error {}

/** UTF-8 (with or without BOM); falls back to Windows-1252 for files exported by older Excel/ERP systems. */
export function decode(buf: Buffer): string {
  const b = buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf ? buf.subarray(3) : buf;
  try { return new TextDecoder("utf-8", { fatal: true }).decode(b); } catch { return new TextDecoder("windows-1252").decode(b); }
}

/**
 * Picks the delimiter that splits the file most consistently: the one where the most rows have the same
 * (more than one) number of fields. Works with quoted newlines and title lines above the header.
 */
export function detectDelimiter(text: string): string {
  const sample = text.slice(0, 20000);
  let best = ",", bestScore = 0;
  for (const d of [";", "\t", ",", "|"]) {
    const rows = parseCsv(sample, d).slice(0, 200);
    const counts = new Map<number, number>();
    for (const r of rows) counts.set(r.length, (counts.get(r.length) ?? 0) + 1);
    const [width, n] = [...counts].sort((x, y) => y[1] - x[1] || y[0] - x[0])[0] ?? [1, 0];
    const score = width > 1 ? (n / rows.length) * width : 0;
    if (score > bestScore) { best = d; bestScore = score; }
  }
  return best;
}

/** RFC 4180 style: quoted fields, doubled quotes, newlines inside quotes. */
export function parseCsv(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false; } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === delimiter) { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((x) => x.trim() !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((x) => x.trim() !== "")) rows.push(row);
  return rows;
}

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");

// Header names seen in English, Spanish (MMR is Spanish), Norwegian and common ERP exports – best match first.
const SKU_HEADERS = ["sku", "ref", "referencia", "reference", "refmmr", "codigo", "codigoarticulo", "codarticulo", "articulo", "itemcode", "itemno", "item", "partno", "partnumber", "productcode", "modelcode", "artnr", "artikelnr", "artikkelnr", "varenr", "varenummer", "code"];
const QTY_HEADERS = ["stock", "stocks", "stockdisponible", "disponible", "disponibles", "existencias", "cantidad", "unidades", "units", "qty", "quantity", "available", "onhand", "inventory", "lager", "lagersaldo", "lagerbeholdning", "saldo", "antall"];

function pick(headers: string[], wanted: string[], override?: string): number {
  if (override) { const i = headers.findIndex((h) => norm(h) === norm(override)); if (i >= 0) return i; }
  for (const w of wanted) { const i = headers.findIndex((h) => norm(h) === w); if (i >= 0) return i; }
  return -1;
}

/** "12", "12,0", "1.234", "1 234", "1,234.00", "1.234,00" → integer (floor); null if not a number. */
export function parseQty(raw: string): number | null {
  let s = raw.trim().replace(/[\s ']/g, "");
  if (!/^-?[\d.,]+$/.test(s)) return null;
  const lastDot = s.lastIndexOf("."), lastComma = s.lastIndexOf(",");
  if (lastDot >= 0 && lastComma >= 0) s = lastDot > lastComma ? s.replace(/,/g, "") : s.replace(/\./g, "").replace(",", ".");
  else if (lastComma >= 0) s = /,\d{3}$/.test(s) && s.indexOf(",") === lastComma && s.length > 4 && !/^0,/.test(s) ? s.replace(",", "") : s.replace(",", ".");
  else if (lastDot >= 0 && /\.\d{3}$/.test(s) && s.indexOf(".") === lastDot && !/^0\./.test(s)) s = s.replace(".", "");
  const n = Number(s);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : null;
}

export function parseStockCsv(buf: Buffer, opts: { skuColumn?: string; qtyColumn?: string } = {}): ParsedStock {
  const text = decode(buf);
  if (!text.trim()) throw new CsvError("Filen er tom.");
  const delimiter = detectDelimiter(text);
  const all = parseCsv(text, delimiter);
  // The header may be preceded by title/date lines: take the first of the first 15 rows that has both an SKU and a quantity column.
  let headerAt = -1, skuI = -1, qtyI = -1;
  for (let r = 0; r < Math.min(all.length, 15); r++) {
    const s = pick(all[r], SKU_HEADERS, opts.skuColumn), q = pick(all[r], QTY_HEADERS, opts.qtyColumn);
    if (s >= 0 && q >= 0 && s !== q) { headerAt = r; skuI = s; qtyI = q; break; }
  }
  if (headerAt < 0) throw new CsvError(`Fant ikke kolonner for SKU og lagerantall. Overskrifter i filen: ${(all[0] ?? []).map((h) => `«${h.trim()}»`).join(", ")}. Sett STOCK_SKU_COLUMN / STOCK_QTY_COLUMN hvis navnene er uvanlige.`);

  const sums = new Map<string, number>();
  let rowsTotal = 0, skipped = 0;
  for (const r of all.slice(headerAt + 1)) {
    rowsTotal++;
    const sku = (r[skuI] ?? "").trim();
    const qty = parseQty(r[qtyI] ?? "");
    if (!sku || qty === null) { skipped++; continue; }
    sums.set(sku, (sums.get(sku) ?? 0) + qty);
  }
  if (!sums.size) throw new CsvError("Ingen gyldige rader (SKU + antall) i filen.");
  return { rows: [...sums].map(([sku, qty]) => ({ sku, qty })), rowsTotal, skipped, delimiter, skuColumn: all[headerAt][skuI].trim(), qtyColumn: all[headerAt][qtyI].trim() };
}
