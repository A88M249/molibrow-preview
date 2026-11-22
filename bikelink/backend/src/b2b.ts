import { pool } from "./db.js";

export const VAT_RATE = 0.25;

/** Wholesale unit price excl. VAT, in øre. Override wins; else retail (incl. VAT) → excl. VAT → minus account discount. */
export function wholesalePrice(retailIncVatOre: number, discountPct: number, overrideOre?: number | null): number {
  if (overrideOre != null) return overrideOre;
  const exVat = retailIncVatOre / (1 + VAT_RATE);
  return Math.round(exVat * (1 - discountPct / 100));
}

export type CatalogRow = { sku: string; slug: string; name: string; size: string | null; image: string | null; stock: number; retailOre: number; priceOre: number };

/** Every active variant with this account's price and the live stock. */
export async function catalogFor(discountPct: number): Promise<CatalogRow[]> {
  const { rows } = await pool.query(
    `SELECT p.sku, p.slug, p.name, p.size, p.image_url, p.stock, p.price_ore, w.price_ore AS override
       FROM products p LEFT JOIN wholesale_prices w ON w.sku = p.sku
      WHERE p.active ORDER BY p.name, p.id`);
  return rows.map((r) => ({
    sku: r.sku, slug: r.slug, name: r.name, size: r.size, image: r.image_url, stock: r.stock, retailOre: r.price_ore,
    priceOre: wholesalePrice(r.price_ore, discountPct, r.override),
  }));
}

export class OrderError extends Error {}

export type B2bItem = { sku: string; quantity: number };

/**
 * Places an order and reserves stock in one transaction. Rows are locked in id order,
 * so two dealers ordering the last bike at the same time cannot both succeed (and cannot deadlock).
 */
export async function placeB2bOrder(
  account: { id: number; discountPct: number },
  items: B2bItem[],
  details: { reference?: string; note?: string; deliveryAddress: string },
): Promise<{ id: string; orderNo: number; subtotalOre: number; lines: { sku: string; name: string; size: string | null; quantity: number; priceOre: number }[] }> {
  const merged = new Map<string, number>();
  for (const i of items) merged.set(i.sku, (merged.get(i.sku) ?? 0) + i.quantity);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `SELECT p.id, p.sku, p.name, p.size, p.stock, p.price_ore, w.price_ore AS override
         FROM products p LEFT JOIN wholesale_prices w ON w.sku = p.sku
        WHERE p.active AND p.sku = ANY($1) ORDER BY p.id FOR UPDATE OF p`, [[...merged.keys()]]);
    const lines = [];
    for (const [sku, quantity] of merged) {
      const p = rows.find((r) => r.sku === sku);
      if (!p) throw new OrderError(`Product ${sku} is not available`);
      if (p.stock < quantity) throw new OrderError(`Not enough stock for ${p.name}${p.size ? ` (${p.size})` : ""}: ${p.stock} left`);
      lines.push({ id: p.id, sku, name: p.name, size: p.size as string | null, quantity, priceOre: wholesalePrice(p.price_ore, account.discountPct, p.override) });
    }
    const subtotalOre = lines.reduce((s, l) => s + l.priceOre * l.quantity, 0);
    const { rows: [o] } = await client.query(
      `INSERT INTO b2b_orders (account_id, reference, note, delivery_address, subtotal_ore) VALUES ($1,$2,$3,$4,$5) RETURNING id, order_no`,
      [account.id, details.reference ?? null, details.note ?? null, details.deliveryAddress, subtotalOre]);
    for (const l of lines) {
      await client.query("INSERT INTO b2b_order_items (order_id, product_id, quantity, price_ore) VALUES ($1,$2,$3,$4)", [o.id, l.id, l.quantity, l.priceOre]);
      await client.query("UPDATE products SET stock = stock - $2 WHERE id = $1", [l.id, l.quantity]);
    }
    await client.query("COMMIT");
    return { id: o.id, orderNo: o.order_no, subtotalOre, lines: lines.map(({ sku, name, size, quantity, priceOre }) => ({ sku, name, size, quantity, priceOre })) };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

const NEXT: Record<string, string[]> = { placed: ["confirmed", "cancelled"], confirmed: ["shipped", "cancelled"], shipped: [], cancelled: [] };

/** Moves an order along placed → confirmed → shipped; cancelling gives the reserved stock back. */
export async function setB2bOrderStatus(orderId: string, status: "confirmed" | "shipped" | "cancelled"): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows: [o] } = await client.query("SELECT status FROM b2b_orders WHERE id = $1 FOR UPDATE", [orderId]);
    if (!o) throw new OrderError("Order not found");
    if (!NEXT[o.status].includes(status)) throw new OrderError(`Cannot change an order from ${o.status} to ${status}`);
    if (status === "cancelled") {
      await client.query(`UPDATE products p SET stock = p.stock + i.quantity FROM b2b_order_items i WHERE i.order_id = $1 AND i.product_id = p.id`, [orderId]);
    }
    await client.query("UPDATE b2b_orders SET status = $2 WHERE id = $1", [orderId, status]);
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
