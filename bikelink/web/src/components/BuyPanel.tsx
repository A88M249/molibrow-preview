"use client";
import Link from "next/link";
import { useState } from "react";
import { useCart } from "./CartProvider";

type V = { sku: string; size: string | null; priceOre: number; available: boolean };

export function BuyPanel({ handle, title, image, variants }: { handle: string; title: string; image: string | null; variants: V[] }) {
  const { add } = useCart();
  const firstAvail = variants.find((v) => v.available);
  const [sku, setSku] = useState(firstAvail?.sku ?? "");
  const [added, setAdded] = useState(false);
  const chosen = variants.find((v) => v.sku === sku);

  return (
    <div>
      <h2 className="label" id="storrelse">Størrelse</h2>
      <div className="sizes" role="radiogroup" aria-labelledby="storrelse">
        {variants.map((v) => (
          <button key={v.sku} type="button" role="radio" aria-checked={sku === v.sku} disabled={!v.available}
            className={`size ${sku === v.sku ? "on" : ""}`} onClick={() => { setSku(v.sku); setAdded(false); }}>
            {v.size ?? "Standard"}{!v.available && <small>utsolgt</small>}
          </button>
        ))}
      </div>
      <p className={chosen ? "stock ok" : "stock"}>{firstAvail ? (chosen ? "På lager" : "Velg størrelse") : "Utsolgt"}</p>

      <button type="button" className="btn block" disabled={!chosen}
        onClick={() => { if (!chosen) return; add({ sku: chosen.sku, handle, title, size: chosen.size, priceOre: chosen.priceOre, image }); setAdded(true); }}>
        {firstAvail ? "Legg i handlekurven" : "Utsolgt"}
      </button>
      <p className="added" role="status">{added && <>Lagt i handlekurven. <Link href="/handlekurv">Gå til handlekurven →</Link></>}</p>
    </div>
  );
}
