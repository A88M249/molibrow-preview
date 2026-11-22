"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { CART_KEY, type CartLine } from "@/lib/cart";

type Ctx = { lines: CartLine[]; ready: boolean; add: (l: Omit<CartLine, "quantity">) => void; setQty: (sku: string, q: number) => void; clear: () => void };
const CartCtx = createContext<Ctx | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try { setLines(JSON.parse(localStorage.getItem(CART_KEY) ?? "[]")); } catch { /* private mode: start empty */ }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(CART_KEY, JSON.stringify(lines)); } catch { /* ignore */ }
  }, [lines, ready]);

  const value: Ctx = {
    lines, ready,
    add: (l) => setLines((cur) => cur.some((x) => x.sku === l.sku) ? cur.map((x) => (x.sku === l.sku ? { ...x, quantity: Math.min(x.quantity + 1, 20) } : x)) : [...cur, { ...l, quantity: 1 }]),
    setQty: (sku, q) => setLines((cur) => (q <= 0 ? cur.filter((x) => x.sku !== sku) : cur.map((x) => (x.sku === sku ? { ...x, quantity: Math.min(q, 20) } : x)))),
    clear: () => setLines([]),
  };
  return <CartCtx.Provider value={value}>{children}</CartCtx.Provider>;
}

export function useCart() {
  const c = useContext(CartCtx);
  if (!c) throw new Error("useCart outside CartProvider");
  return c;
}
