import { pool } from "./db.js";

export type CartLine = { sku: string; quantity: number };
export type PricedLine = CartLine & { productId: number; name: string; priceOre: number };

/** Look up real prices; reject unknown, inactive or out-of-stock items. */
export async function priceCart(cart: CartLine[]): Promise<PricedLine[]> {
  const { rows } = await pool.query(
    "SELECT id, sku, name, size, price_ore, stock FROM products WHERE active AND sku = ANY($1)",
    [cart.map((l) => l.sku)],
  );
  return cart.map((line) => {
    const p = rows.find((r) => r.sku === line.sku);
    if (!p) throw new Error(`Product ${line.sku} not available`);
    if (p.stock < line.quantity) throw new Error(`Not enough stock for ${p.name}${p.size ? ` (${p.size})` : ""}`);
    return { ...line, productId: p.id, name: p.size ? `${p.name} – ${p.size}` : p.name, priceOre: p.price_ore };
  });
}

export async function createOrder(
  provider: "stripe" | "vipps",
  email: string,
  lines: PricedLine[],
  delivery: { method: "home" | "dealer"; dealerId?: string } = { method: "home" },
): Promise<{ id: string; totalOre: number }> {
  const totalOre = lines.reduce((s, l) => s + l.priceOre * l.quantity, 0);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      "INSERT INTO orders (provider, email, total_ore, delivery_method, dealer_id) VALUES ($1,$2,$3,$4,$5) RETURNING id",
      [provider, email, totalOre, delivery.method, delivery.dealerId ?? null],
    );
    for (const l of lines) {
      await client.query(
        "INSERT INTO order_items (order_id, product_id, quantity, price_ore) VALUES ($1,$2,$3,$4)",
        [rows[0].id, l.productId, l.quantity, l.priceOre],
      );
    }
    await client.query("COMMIT");
    return { id: rows[0].id, totalOre };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function setProviderRef(orderId: string, ref: string) {
  await pool.query("UPDATE orders SET provider_ref = $2 WHERE id = $1", [orderId, ref]);
}

/**
 * Mark an order paid and take stock. Safe to call twice: only the first call
 * (status still 'pending') changes anything.
 */
export async function markPaid(orderId: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rowCount } = await client.query(
      "UPDATE orders SET status = 'paid' WHERE id = $1 AND status = 'pending'",
      [orderId],
    );
    if (rowCount) {
      await client.query(
        `UPDATE products p SET stock = GREATEST(p.stock - i.quantity, 0)
           FROM order_items i WHERE i.order_id = $1 AND i.product_id = p.id`,
        [orderId],
      );
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
