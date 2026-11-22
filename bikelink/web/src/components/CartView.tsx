"use client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { cartTotal } from "@/lib/cart";
import { PICKUP_DEALERS } from "@/lib/dealers";
import { kr } from "@/lib/products";
import { useCart } from "./CartProvider";

const API = process.env.NEXT_PUBLIC_API_URL;

export function CartView() {
  const { lines, ready, setQty, clear } = useCart();
  const [provider, setProvider] = useState<"stripe" | "vipps">("stripe");
  const [delivery, setDelivery] = useState<"home" | "dealer">("home");
  const [dealer, setDealer] = useState(PICKUP_DEALERS[0].id);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!ready) return <p className="muted">Laster …</p>;
  if (lines.length === 0)
    return (
      <div className="empty">
        <p className="lead">Handlekurven er tom.</p>
        <Link className="btn" href="/landevei">Se sykler</Link>
      </div>
    );

  async function pay(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!API) { setError("Betaling er ikke koblet til denne forhåndsvisningen ennå."); return; }
    setBusy(true);
    try {
      const res = await fetch(`${API}/checkout`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider, email, delivery: delivery === "home" ? { method: "home" } : { method: "dealer", dealerId: dealer }, items: lines.map((l) => ({ sku: l.sku, quantity: l.quantity })) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Kunne ikke starte betalingen.");
      window.location.href = data.redirectUrl;
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form className="cart" onSubmit={pay}>
      <div>
        <ul className="cart-lines">
          {lines.map((l) => (
            <li key={l.sku}>
              {l.image && <Image src={l.image} alt="" width={120} height={90} />}
              <div className="cart-info">
                <Link href={`/sykkel/${l.handle}`}><strong>{l.title}</strong></Link>
                <span className="muted small">{l.size ? `Størrelse ${l.size}` : ""}</span>
                <span className="qty">
                  <button type="button" aria-label="Færre" onClick={() => setQty(l.sku, l.quantity - 1)}>−</button>
                  <output>{l.quantity}</output>
                  <button type="button" aria-label="Flere" onClick={() => setQty(l.sku, l.quantity + 1)}>+</button>
                  <button type="button" className="link" onClick={() => setQty(l.sku, 0)}>Fjern</button>
                </span>
              </div>
              <strong>{kr(l.priceOre * l.quantity)}</strong>
            </li>
          ))}
        </ul>
        <button type="button" className="link" onClick={clear}>Tøm handlekurven</button>
      </div>

      <aside className="summary">
        <h2>Levering</h2>
        <label className="opt"><input type="radio" name="d" checked={delivery === "home"} onChange={() => setDelivery("home")} /> Hjemlevering</label>
        <label className="opt"><input type="radio" name="d" checked={delivery === "dealer"} onChange={() => setDelivery("dealer")} /> Hent hos forhandler</label>
        {delivery === "dealer" && (
          <select value={dealer} onChange={(e) => setDealer(e.target.value)} aria-label="Velg forhandler">
            {PICKUP_DEALERS.map((d) => <option key={d.id} value={d.id}>{d.city} – {d.name}</option>)}
          </select>
        )}
        <h2>Betaling</h2>
        <label className="opt"><input type="radio" name="p" checked={provider === "stripe"} onChange={() => setProvider("stripe")} /> Kort eller Klarna</label>
        <label className="opt"><input type="radio" name="p" checked={provider === "vipps"} onChange={() => setProvider("vipps")} /> Vipps</label>
        <label className="field">E-post<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>
        <p className="sum"><span>Totalt inkl. mva</span><strong>{kr(cartTotal(lines))}</strong></p>
        <p className="small muted">Frakt er inkludert i prisen.</p>
        <button className="btn block" disabled={busy}>{busy ? "Går videre …" : "Gå til betaling"}</button>
        {error && <p className="error" role="alert">{error}</p>}
      </aside>
    </form>
  );
}
