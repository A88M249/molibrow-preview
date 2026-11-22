"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { API } from "@/lib/b2b";
import { useCart } from "./CartProvider";
import { useColour } from "./ColourScope";
import { useDealer } from "./DealerProvider";

type V = { sku: string; size: string | null; colour: string | null; priceOre: number; available: boolean };

/**
 * Colour, size and stock. Everything is pre-rendered (for search engines and speed); in the browser the stock is checked against
 * the live API, so a size that sold out since the last build cannot be added to the cart.
 */
export function BuyPanel({ handle, title, image, variants, colours }: { handle: string; title: string; image: string | null; variants: V[]; colours: string[] }) {
  const { add } = useCart();
  const { dealer } = useDealer();
  const { colour, setColour } = useColour();
  const [live, setLive] = useState<Record<string, number> | null>(null);
  const [sku, setSku] = useState("");
  const [added, setAdded] = useState(false);
  const multi = colours.length > 1;

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
  const all = useMemo(() => variants.map((v) => ({ ...v, avail: stockOf(v) !== null ? (stockOf(v) as number) > 0 : v.available })), [variants, live]); // eslint-disable-line react-hooks/exhaustive-deps
  const colourAvail = (c: string) => all.some((v) => v.colour === c && v.avail);
  const sizes = multi ? all.filter((v) => v.colour === colour) : all;

  // If the selected colour has nothing in stock but another has, switch to it.
  useEffect(() => {
    if (multi && colour && !colourAvail(colour)) { const next = colours.find(colourAvail); if (next) setColour(next); }
  }, [all, colour]); // eslint-disable-line react-hooks/exhaustive-deps
  // Keep a valid size selected for the chosen colour.
  useEffect(() => {
    const cur = sizes.find((s) => s.sku === sku);
    if (!cur || !cur.avail) setSku(sizes.find((s) => s.avail)?.sku ?? "");
  }, [sizes, sku]);

  const chosen = sizes.find((s) => s.sku === sku);
  const left = chosen ? stockOf(chosen) : null;
  const anyAvail = sizes.some((s) => s.avail);

  return (
    <div>
      {multi && (
        <>
          <h2 className="label" id="farge">Farge</h2>
          <div className="colour-pick" role="radiogroup" aria-labelledby="farge">
            {colours.map((c) => (
              <button key={c} type="button" role="radio" aria-checked={colour === c} className={`colour-btn ${colour === c ? "on" : ""}`} disabled={!colourAvail(c)} onClick={() => { setColour(c); setAdded(false); }}>
                {c}{!colourAvail(c) && <small> utsolgt</small>}
              </button>
            ))}
          </div>
        </>
      )}
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
        onClick={() => { if (!chosen) return; add({ sku: chosen.sku, handle, title, size: chosen.size, colour: multi ? chosen.colour : null, priceOre: chosen.priceOre, image }); setAdded(true); }}>
        {anyAvail ? (dealer ? "Kjøp som privatkunde (veil. pris)" : "Legg i handlekurven") : "Utsolgt"}
      </button>
      <p className="added" role="status">{added && <>Lagt i handlekurven. <Link href="/handlekurv">Gå til handlekurven →</Link></>}</p>
    </div>
  );
}
