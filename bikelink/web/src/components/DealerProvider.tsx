"use client";
import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { API, ApiError, DEALER_KEY, api, dealerLogout, getToken, kr, pct, priceBreakdown, setToken } from "@/lib/b2b";

type Dealer = { company: string; contactName: string; discountPct: number };
type Item = { sku: string; slug: string; priceOre: number; retailOre: number };
type Ctx = {
  dealer: Dealer | null;
  /** B2B price (excl. VAT) for one SKU, in øre. */
  price: (sku: string) => number | null;
  /** Cheapest B2B price and cheapest retail price (incl. VAT) over all sizes of a product. */
  from: (slug: string) => { priceOre: number; retailOre: number } | null;
};
const DealerCtx = createContext<Ctx>({ dealer: null, price: () => null, from: () => null });
export const useDealer = () => useContext(DealerCtx);

/**
 * When a B2B partner is signed in (portal login), the whole shop switches to their prices.
 * Pages stay pre-rendered and public; the dealer's prices are fetched in the browser with their token only.
 */
export function DealerProvider({ children }: { children: React.ReactNode }) {
  const [dealer, setDealer] = useState<Dealer | null>(null);
  const [items, setItems] = useState<Item[]>([]);

  const load = useCallback(async () => {
    const t = getToken(DEALER_KEY);
    if (!t || !API) { setDealer(null); setItems([]); return; }
    try {
      const [me, cat] = await Promise.all([api<Dealer>("/b2b/me", { token: t }), api<{ items: Item[] }>("/b2b/catalog", { token: t })]);
      setDealer(me); setItems(cat.items);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setToken(DEALER_KEY, null); // expired or closed account
      setDealer(null); setItems([]);
    }
  }, []);

  // lets the CSS shift the transparent header down by the height of the B2B bar
  useEffect(() => { document.body.classList.toggle("has-dealer", Boolean(dealer)); }, [dealer]);

  useEffect(() => {
    load();
    window.addEventListener("bikelink-dealer-change", load);
    return () => window.removeEventListener("bikelink-dealer-change", load);
  }, [load]);

  const value = useMemo<Ctx>(() => {
    const bySku = new Map(items.map((i) => [i.sku, i.priceOre]));
    const bySlug = new Map<string, { priceOre: number; retailOre: number }>();
    for (const i of items) {
      const cur = bySlug.get(i.slug);
      if (!cur) bySlug.set(i.slug, { priceOre: i.priceOre, retailOre: i.retailOre });
      else bySlug.set(i.slug, { priceOre: Math.min(cur.priceOre, i.priceOre), retailOre: Math.min(cur.retailOre, i.retailOre) });
    }
    return { dealer, price: (sku) => bySku.get(sku) ?? null, from: (slug) => bySlug.get(slug) ?? null };
  }, [dealer, items]);

  return <DealerCtx.Provider value={value}>{children}</DealerCtx.Provider>;
}

/** Thin bar across the top while a B2B partner is signed in. */
export function DealerBar() {
  const { dealer } = useDealer();
  if (!dealer) return null;
  return (
    <div className="dealer-bar" role="status">
      <span><strong>B2B</strong> · {dealer.company} · priser vises <strong>eks. mva</strong>{dealer.discountPct > 0 ? ` (din rabatt: ${dealer.discountPct} %)` : ""}</span>
      <span><Link href="/b2b/portal">Til forhandlerportalen</Link><button type="button" className="link" onClick={dealerLogout}>Logg ut</button></span>
    </div>
  );
}

/** "B2B from X kr excl. VAT" on listing cards. */
export function DealerFrom({ slug }: { slug: string }) {
  const { dealer, from } = useDealer();
  const f = dealer ? from(slug) : null;
  if (!f) return null;
  const b = priceBreakdown(f.retailOre, f.priceOre);
  return <p className="mono dealer-price">B2B fra {kr(f.priceOre)} eks. mva · margin {pct(b.marginPct)}</p>;
}

/** B2B price block on the product page: recommended retail price, B2B price excl./incl. VAT, and the dealer's margin. */
export function DealerPriceBlock({ slug }: { slug: string }) {
  const { dealer, from } = useDealer();
  const f = dealer ? from(slug) : null;
  if (!dealer || !f) return null;
  const b = priceBreakdown(f.retailOre, f.priceOre);
  return (
    <div className="dealer-block" aria-label="B2B-pris">
      <p className="mono">Din B2B-pris</p>
      <p className="price big">{kr(b.b2bExVatOre)} <span className="small muted">eks. mva</span></p>
      <dl className="dealer-grid">
        <dt>B2B-pris inkl. 25 % mva</dt><dd>{kr(b.b2bIncVatOre)}</dd>
        <dt>Veil. utsalgspris inkl. mva</dt><dd>{kr(b.retailIncVatOre)}</dd>
        <dt>Veil. utsalgspris eks. mva</dt><dd>{kr(b.retailExVatOre)}</dd>
        <dt>Din margin</dt><dd className={b.marginOre < 0 ? "neg" : "pos"}><strong>{kr(b.marginOre)}</strong> · {pct(b.marginPct)}</dd>
      </dl>
      <p className="small muted">Margin = veil. utsalgspris eks. mva − din B2B-pris, i % av utsalgsprisen (påslag på innkjøp: {pct(b.markupPct)}). Prisen kan variere mellom størrelser – eksakt pris vises i portalen.</p>
    </div>
  );
}
