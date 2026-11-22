import type { Metadata } from "next";
import { CartView } from "@/components/CartView";

export const metadata: Metadata = { title: "Handlekurv", robots: { index: false, follow: false } };

export default function CartPage() {
  return (
    <div className="wrap section">
      <h1>Handlekurv</h1>
      <CartView />
    </div>
  );
}
