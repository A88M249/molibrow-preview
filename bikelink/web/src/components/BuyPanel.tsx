"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { API } from "@/lib/b2b";
import { useCart } from "./CartProvider";
import { useDealer } from "./DealerProvider";

type V = { sku: string; size: string | null; priceOre: number; available: boolean };

/**
 * Sizes and stock come pre-rendered (for search engines and speed). In the browser they are checked against the live stock
 * in the API, so a size that sold out since the last build cannot be added to the cart.
 */
export function BuyPanel({ handle, title, image, variants }: { handle: string; title: string; image: string | null; variants: V[] }) {
  const { add } = useCart();
  const { dealer } = useDealer();
  const [live, setLive] = useState<Record<string, number> | null>(null);
  const [sku, setSku] = useState(variants.find((v) => v.available)?.sku ?? "");
  const [added, setAdded] = useState(false);

  useEffect(() => {
    if (!API) return;
    const ctl = new AbortController();
    fetch(`${API}/products/${encodeURIComponent(handle)}`, { signal: ctl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { variants?: { sku: string; stock: number }[] } | null) => { if (d?.variants) setLive(Object.fromEntries(d.variants.map((v) => [v.sku, v.stock]))); })
      .catch(() => { /* keep the pre-rendered state */ });
    return () => ctl.abort();
  }, [handle]);

  const stockOf = (v: V): number | null => (live && v.sku in live ? live[v.sku] : null);
  const isAvail = (v: V) => (stockOf(v) !== null ? (stockOf(v) as number) > 0 : v.available);
  const sizes = useMemo(() => variants.map((v) => ({ ...v, avail: isAvail(v) })), [variants, live]); // eslint-disable-line react-hooks/exhaustive-deps

  // If the selected size turns out to be sold out, move to the first size that is in stock.
  useEffect(() => {
    const cur = sizes.find((s) => s.sku === sku);
    if (!cur || !cur.avail) setSku(sizes.find((s) => s.avail)?.sku ?? "");
  }, [sizes, sku]);

  const chosen = sizes.find((s) => s.sku === sku);
  const left = chosen ? stockOf(chosen) : null;
  const anyAvail = sizes.some((s) => s.avail);

  return (
    <div>
      <h2 className="label" id="storrelse">Størrelse</h2>
      <div className="sizes" role="radiogroup" aria-labelledby="storrelse">
        {sizes.map((v) => (
          <button key={v.sku} type="button" role="radio" aria-checked={sku === v.sku} disabled={!v.avail}
            className={`size ${sku === v.sku ? "on" : ""}`} onClick={() => { setSku(v.sku); setAdded(false); }}>
            {v.size ?? "Standard"}{!v.avail && <small>utsolgt</small>}
          </button>
        ))}
      </div>
      <p className={chosen ? "stock ok" : "stock"}>{anyAvail ? (chosen ? (left !== null && left <= 3 ? `Kun ${left} igjen` : "På lager") : "Velg størrelse") : "Utsolgt"}</p>

      {dealer && <Link className="btn block" href={`/b2b/portal?q=${encodeURIComponent(title.replace(/^MMR\s+/, ""))}`}>Bestill i forhandlerportalen (B2B-pris)</Link>}
      <button type="button" className={`btn block ${dealer ? "ghost" : ""}`} disabled={!chosen}
        onClick={() => { if (!chosen) return; add({ sku: chosen.sku, handle, title, size: chosen.size, priceOre: chosen.priceOre, image }); setAdded(true); }}>
        {anyAvail ? (dealer ? "Kjøp som privatkunde (veil. pris)" : "Legg i handlekurven") : "Utsolgt"}
      </button>
      <p className="added" role="status">{added && <>Lagt i handlekurven. <Link href="/handlekurv">Gå til handlekurven →</Link></>}</p>
    </div>
  );
}
