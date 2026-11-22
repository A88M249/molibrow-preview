"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError, DEALER_KEY, STATUS_NO, announceDealerChange, api, dateTime, getToken, kr, krDec, setToken } from "@/lib/b2b";

type Me = { company: string; contactName: string; email: string; address: string; discountPct: number };
type Row = { sku: string; slug: string; name: string; size: string | null; stock: number; retailOre: number; priceOre: number };
type OrderRow = { id: string; order_no: number; status: string; reference: string | null; subtotal_ore: number; created_at: string; units: number };
type OrderDetail = OrderRow & { note: string | null; delivery_address: string; items: { sku: string; name: string; size: string | null; quantity: number; price_ore: number }[] };
const VAT = 0.25;

export function Portal() {
  const router = useRouter();
  const [token, setTok] = useState<string | null | undefined>(undefined);
  const [me, setMe] = useState<Me | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [stockAt, setStockAt] = useState<string | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [tab, setTab] = useState<"katalog" | "ordre" | "konto">("katalog");
  const [error, setError] = useState("");

  const logout = useCallback(() => { setToken(DEALER_KEY, null); announceDealerChange(); router.push("/b2b/logg-inn"); }, [router]);
  const guard = useCallback((e: unknown) => { if (e instanceof ApiError && e.status === 401) logout(); else setError((e as Error).message); }, [logout]);

  const loadCatalog = useCallback(async (t: string) => { try { const c = await api<{ items: Row[]; stockUpdatedAt: string | null }>("/b2b/catalog", { token: t }); setRows(c.items); setStockAt(c.stockUpdatedAt); } catch (e) { guard(e); } }, [guard]);
  const loadOrders = useCallback(async (t: string) => { try { setOrders(await api<OrderRow[]>("/b2b/orders", { token: t })); } catch (e) { guard(e); } }, [guard]);

  useEffect(() => { setTok(getToken(DEALER_KEY)); }, []);
  useEffect(() => {
    if (token === undefined) return;
    if (!token) { router.replace("/b2b/logg-inn"); return; }
    api<Me>("/b2b/me", { token }).then(setMe).catch(guard);
    loadCatalog(token); loadOrders(token);
  }, [token, router, guard, loadCatalog, loadOrders]);

  if (!token || !me) return <div className="wrap section"><p className="muted">{error || "Laster …"}</p></div>;
  return (
    <div className="wrap section">
      <div className="portal-head">
        <div><p className="mono muted">Forhandlerportal</p><h1>{me.company}</h1></div>
        <nav className="tabs" aria-label="Portal">
          {(["katalog", "ordre", "konto"] as const).map((t) => <button key={t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>{{ katalog: "Bestill", ordre: "Mine ordre", konto: "Konto" }[t]}</button>)}
        </nav>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {tab === "katalog" && <Catalog token={token} me={me} rows={rows} stockAt={stockAt} onOrdered={() => { loadCatalog(token); loadOrders(token); setTab("ordre"); }} guard={guard} />}
      {tab === "ordre" && <Orders token={token} orders={orders} guard={guard} />}
      {tab === "konto" && (
        <div className="feature account">
          <h3>Kontoopplysninger</h3>
          <p>{me.contactName}<br />{me.email}<br />{me.address}</p>
          <p className="muted">Din avtalte rabatt: <strong>{me.discountPct} %</strong> på veiledende pris eks. mva (med mindre prislisten har egen pris). Oppgjør: faktura etter avtale.</p>
          <p className="small muted">Spørsmål om pris, lager eller levering: <a href="mailto:info@bikelink.no">info@bikelink.no</a> · <a href="tel:+4746411906">+47 46 41 19 06</a></p>
          <button className="btn ghost" onClick={logout}>Logg ut</button>
        </div>
      )}
    </div>
  );
}

function Catalog({ token, me, rows, stockAt, onOrdered, guard }: { token: string; me: Me; rows: Row[]; stockAt: string | null; onOrdered: () => void; guard: (e: unknown) => void }) {
  const [q, setQ] = useState(() => (typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("q") ?? ""));
  const [onlyStock, setOnlyStock] = useState(false);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [address, setAddress] = useState(me.address);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const shown = useMemo(() => {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    return rows.filter((r) => (!onlyStock || r.stock > 0) && terms.every((t) => `${r.name} ${r.size ?? ""} ${r.sku}`.toLowerCase().includes(t)));
  }, [rows, q, onlyStock]);
  const lines = rows.filter((r) => (qty[r.sku] ?? 0) > 0);
  const sub = lines.reduce((s, r) => s + r.priceOre * (qty[r.sku] ?? 0), 0);
  const units = lines.reduce((s, r) => s + (qty[r.sku] ?? 0), 0);

  async function submit() {
    setBusy(true); setMsg("");
    try {
      await api("/b2b/orders", { token, body: { items: lines.map((r) => ({ sku: r.sku, quantity: qty[r.sku] })), reference: reference || undefined, note: note || undefined, deliveryAddress: address } });
      setQty({}); setReference(""); setNote("");
      onOrdered();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) setMsg(e.message); else guard(e);
    } finally { setBusy(false); }
  }

  return (
    <div>
      <div className="search-box">
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Søk modell, størrelse eller SKU" aria-label="Søk" />
        <label className="opt"><input type="checkbox" checked={onlyStock} onChange={(e) => setOnlyStock(e.target.checked)} /> Kun på lager</label>
      </div>
      <p className="mono muted small">Priser er eks. mva. {stockAt ? `Lager sist oppdatert ${dateTime(stockAt)}.` : "Lagerstatus oppdateres daglig."} {shown.length} varianter</p>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Modell</th><th>Str.</th><th className="num">Veil. inkl. mva</th><th className="num">Din pris eks. mva</th><th className="num">Lager</th><th className="num">Antall</th></tr></thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.sku} className={r.stock === 0 ? "off" : ""}>
                <td><a href={`/sykkel/${r.slug}`} target="_blank" rel="noopener">{r.name.replace(/^MMR\s+/, "")}</a><small className="mono muted"> {r.sku}</small></td>
                <td>{r.size ?? "–"}</td>
                <td className="num muted">{kr(r.retailOre)}</td>
                <td className="num"><strong>{kr(r.priceOre)}</strong></td>
                <td className="num">{r.stock === 0 ? "Utsolgt" : r.stock}</td>
                <td className="num"><input className="qty-in" type="number" min={0} max={r.stock} disabled={r.stock === 0} value={qty[r.sku] ?? ""} placeholder="0" aria-label={`Antall ${r.name} ${r.size ?? ""}`}
                  onChange={(e) => setQty({ ...qty, [r.sku]: Math.max(0, Math.min(r.stock, Number(e.target.value) || 0)) })} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="order-bar">
        <div className="order-fields">
          <label className="field">Leveringsadresse<input value={address} onChange={(e) => setAddress(e.target.value)} /></label>
          <label className="field">Deres referanse<input value={reference} onChange={(e) => setReference(e.target.value)} maxLength={60} /></label>
          <label className="field">Merknad<input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} /></label>
        </div>
        <div className="order-sum">
          <p className="mono">{units} enheter · {lines.length} varianter</p>
          <p>Sum eks. mva <strong>{krDec(sub)}</strong></p>
          <p className="muted small">Mva 25 % {krDec(Math.round(sub * VAT))} · inkl. mva {krDec(Math.round(sub * (1 + VAT)))}</p>
          {msg && <p className="error" role="alert">{msg}</p>}
          <button className="btn" disabled={!units || busy || !address.trim()} onClick={submit}>{busy ? "Sender …" : "Legg inn ordre"}</button>
          <p className="small muted">Lager reserveres straks. Faktura etter avtale.</p>
        </div>
      </div>
    </div>
  );
}

function Orders({ token, orders, guard }: { token: string; orders: OrderRow[]; guard: (e: unknown) => void }) {
  const [open, setOpen] = useState<OrderDetail | null>(null);
  async function show(id: string) { try { setOpen(await api<OrderDetail>(`/b2b/orders/${id}`, { token })); } catch (e) { guard(e); } }
  if (!orders.length) return <p className="muted">Ingen ordre ennå.</p>;
  return (
    <div className="table-wrap">
      <table className="table">
        <thead><tr><th>Ordre</th><th>Dato</th><th>Status</th><th>Referanse</th><th className="num">Enheter</th><th className="num">Sum eks. mva</th></tr></thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} className="click" onClick={() => show(o.id)} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && show(o.id)}>
              <td>BL-{o.order_no}</td><td>{dateTime(o.created_at)}</td><td><span className={`badge-s ${o.status}`}>{STATUS_NO[o.status]}</span></td><td>{o.reference ?? "–"}</td><td className="num">{o.units}</td><td className="num">{krDec(o.subtotal_ore)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {open && (
        <div className="feature detail">
          <h3>Ordre BL-{open.order_no} – {STATUS_NO[open.status]}</h3>
          <p className="muted small">Levering: {open.delivery_address}{open.note ? ` · Merknad: ${open.note}` : ""}</p>
          <ul>{open.items.map((i) => <li key={i.sku}>{i.name}{i.size ? ` (${i.size})` : ""} × {i.quantity} à {krDec(i.price_ore)}</li>)}</ul>
          <button className="link" onClick={() => setOpen(null)}>Lukk</button>
        </div>
      )}
    </div>
  );
}
