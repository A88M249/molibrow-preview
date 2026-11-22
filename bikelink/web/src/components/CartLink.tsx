"use client";
import Link from "next/link";
import { cartCount } from "@/lib/cart";
import { useCart } from "./CartProvider";

export function CartLink() {
  const { lines, ready } = useCart();
  const n = ready ? cartCount(lines) : 0;
  return (
    <Link href="/handlekurv" className="cart-link" aria-label={n ? `Handlekurv, ${n} varer` : "Handlekurv"}>
      Handlekurv{n > 0 && <span className="count"> ({n})</span>}
    </Link>
  );
}
