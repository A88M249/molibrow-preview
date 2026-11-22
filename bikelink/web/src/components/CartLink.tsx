"use client";
import Link from "next/link";
import { cartCount } from "@/lib/cart";
import { useCart } from "./CartProvider";

export function CartLink() {
  const { lines, ready } = useCart();
  const n = ready ? cartCount(lines) : 0;
  return (
    <Link href="/handlekurv" className="cart-link" aria-label={n ? `Handlekurv, ${n} varer` : "Handlekurv"}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M5 8h14l-1 12H6L5 8Z" strokeLinejoin="round" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></svg>
      {n > 0 && <span className="badge">{n}</span>}
    </Link>
  );
}
