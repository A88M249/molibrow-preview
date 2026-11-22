"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Item = { h: string; t: string; c: string | null; cat: string; f: string; p: number; a: boolean; i: string | null };
const kr = (ore: number) => `${new Intl.NumberFormat("nb-NO").format(Math.round(ore / 100)).replace(/ /g, " ")} kr`;
const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");

export function SearchBox() {
  const [items, setItems] = useState<Item[]>([]);
  const [q, setQ] = useState("");
  const [onlyStock, setOnlyStock] = useState(false);

  useEffect(() => {
    fetch("/search-index.json").then((r) => r.json()).then(setItems).catch(() => setItems([]));
    setQ(new URLSearchParams(window.location.search).get("q") ?? "");
  }, []);

  const hits = useMemo(() => {
    const terms = norm(q).split(/\s+/).filter(Boolean);
    return items.filter((i) => (!onlyStock || i.a) && terms.every((t) => norm(`${i.t} ${i.c ?? ""} ${i.cat} ${i.f}`).includes(t)));
  }, [items, q, onlyStock]);

  return (
    <div>
      <div className="search-box">
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Søk etter modell, farge eller type – f.eks. «aelion», «elsykkel»" aria-label="Søk" autoFocus />
        <label className="opt"><input type="checkbox" checked={onlyStock} onChange={(e) => setOnlyStock(e.target.checked)} /> Kun på lager</label>
      </div>
      <p className="mono muted" role="status">{items.length ? `${hits.length} treff` : "Laster …"}</p>
      <div className="grid">
        {hits.map((i) => (
          <Link key={i.h} href={`/sykkel/${i.h}`} className="card">
            <div className="card-img">{i.i && <Image src={i.i} alt="" width={600} height={450} sizes="(max-width:700px) 50vw, 25vw" />}{!i.a && <span className="tag">Utsolgt</span>}</div>
            <h3>{i.t}</h3><p className="mono sub">{i.cat}{i.c ? ` · ${i.c}` : ""}</p><p className="price mono">{kr(i.p)}</p>
          </Link>
        ))}
      </div>
      {items.length > 0 && hits.length === 0 && <p>Ingen treff. Prøv et annet ord, eller <Link href="/kontakt" className="more">kontakt oss</Link>.</p>}
    </div>
  );
}
