"use client";
import { useCallback, useEffect, useState } from "react";
import { ADMIN_KEY, ApiError, STATUS_NO, api, dateTime, fileToBase64, getToken, kr, krDec, parsePriceList, setToken } from "@/lib/b2b";
import { AdminLogin, type AdminInfo } from "./AdminLogin";

type Account = { id: number; company: string; org_nr: string; contact_name: string; email: string; phone: string; address: string; business_type: string; website: string | null; message: string | null; status: string; discount_pct: string; activated: boolean; created_at: string };
type B2bOrder = { id: string; order_no: number; status: string; reference: string | null; subtotal_ore: number; created_at: string; company: string; email: string };
type ShopOrder = { id: string; status: string; provider: string; email: string; total_ore: number; delivery_method: string; dealer_id: string | null; created_at: string };
type Stock = { sku: string; name: string; size: string | null; stock: number; active: boolean; price_ore: number; wholesale_ore: number | null };
type Tab = "soknader" | "b2b" | "butikk" | "lager" | "import" | "brukere" | "konto";

export function AdminApp() {
  const [token, setTok] = useState<string | null | undefined>(undefined);
  const [me, setMe] = useState<AdminInfo | null>(null);
  const [tab, setTab] = useState<Tab>("soknader");
  const out = useCallback(() => { setToken(ADMIN_KEY, null); setTok(null); setMe(null); }, []);
  useEffect(() => {
    const t = getToken(ADMIN_KEY);
    if (!t) { setTok(null); return; }
    api<AdminInfo>("/admin/auth/me", { token: t }).then((m) => { setMe(m); setTok(t); }).catch(() => { setToken(ADMIN_KEY, null); setTok(null); });
  }, []);
  if (token === undefined) return null;
  if (!token || !me) return <AdminLogin onDone={(t, a) => { setToken(ADMIN_KEY, t); setMe(a); setTok(t); }} />;
  const owner = me.role === "owner";
  const tabs: [Tab, string][] = [["soknader", "B2B-kontoer"], ["b2b", "B2B-ordre"], ["butikk", "Nettbutikk-ordre"], ["lager", "Lager og priser"], ["import", "Lagerimport"], ...(owner ? [["brukere", "Brukere"] as [Tab, string]] : []), ["konto", "Min konto"]];
  return (
    <div className="wrap section">
      <div className="portal-head">
        <div><p className="mono muted">Back-office · {me.email} ({owner ? "eier" : "ansatt"})</p><h1>BikeLink admin</h1></div>
        <nav className="tabs">
          {tabs.map(([t, l]) => <button key={t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>{l}</button>)}
          <button onClick={out}>Logg ut</button>
        </nav>
      </div>
      {tab === "soknader" && <Accounts token={token} onAuth={out} />}
      {tab === "b2b" && <B2bOrders token={token} onAuth={out} />}
      {tab === "butikk" && <ShopOrders token={token} onAuth={out} />}
      {tab === "lager" && <StockTab token={token} onAuth={out} />}
      {tab === "import" && <ImportTab token={token} onAuth={out} />}
      {tab === "brukere" && owner && <UsersTab token={token} onAuth={out} meEmail={me.email} />}
      {tab === "konto" && <MyAccount token={token} onNewToken={(t) => { setToken(ADMIN_KEY, t); setTok(t); }} />}
    </div>
  );
}

/** Small helper: load a list, expose reload + error handling (401 → log out). */
function useList<T>(path: string, token: string, onAuth: () => void) {
  const [data, setData] = useState<T[] | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try { setData(await api<T[]>(path, { token })); setError(""); } catch (e) { if (e instanceof ApiError && e.status === 401) onAuth(); else setError((e as Error).message); }
  }, [path, token, onAuth]);
  useEffect(() => { load(); }, [load]);
  return { data, error, load, setError };
}

function Accounts({ token, onAuth }: { token: string; onAuth: () => void }) {
  const { data, error, load, setError } = useList<Account>("/admin/b2b/accounts", token, onAuth);
  const [discount, setDiscount] = useState<Record<number, string>>({});
  const [link, setLink] = useState<{ id: number; url: string } | null>(null);
  const act = async (fn: () => Promise<void>) => { try { await fn(); await load(); } catch (e) { setError((e as Error).message); } };
  const approve = (a: Account) => act(async () => {
    const r = await api<{ inviteUrl?: string; emailSent?: boolean }>(`/admin/b2b/accounts/${a.id}/approve`, { token, body: { discountPct: Number(discount[a.id] ?? a.discount_pct) } });
    if (r.inviteUrl) setLink({ id: a.id, url: r.inviteUrl });
  });
  const [adding, setAdding] = useState(false);
  if (!data) return <p className="muted">{error || "Laster …"}</p>;
  return (
    <div>
      {error && <p className="error">{error}</p>}
      <div className="feature" style={{ marginBottom: 16 }}>
        <h3>B2B-partnere</h3>
        <p className="small muted">Godkjente kontoer er merket <span className="badge-s approved">B2B</span> og ser B2B-priser (eks. mva) overalt på nettstedet når de er logget inn. Nye søknader dukker opp her.</p>
        <button className="btn sm ghost" onClick={() => setAdding(!adding)}>{adding ? "Lukk" : "Legg til B2B-partner"}</button>
        {adding && <AddPartner token={token} onDone={(url) => { setAdding(false); setLink({ id: 0, url }); load(); }} onError={setError} />}
      </div>
      {link && <div className="notice ok"><p><strong>Invitasjon opprettet.</strong> E-post er sendt hvis e-post er satt opp. Du kan også sende lenken selv (gyldig i 7 dager):</p><p className="small" style={{ wordBreak: "break-all" }}><code>{link.url}</code></p><button className="link" onClick={() => setLink(null)}>Lukk</button></div>}
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Firma</th><th>Kontakt</th><th>Type</th><th>Status</th><th className="num">Rabatt %</th><th>Handling</th></tr></thead>
          <tbody>
            {data.map((a) => (
              <tr key={a.id}>
                <td><strong>{a.company}</strong><br /><small className="muted">Org.nr. {a.org_nr} · {a.address}</small>{a.message && <><br /><small>«{a.message}»</small></>}</td>
                <td>{a.contact_name}<br /><small><a href={`mailto:${a.email}`}>{a.email}</a> · {a.phone}</small></td>
                <td>{a.business_type}{a.website && <><br /><small><a href={a.website} rel="noopener">{a.website}</a></small></>}</td>
                <td><span className={`badge-s ${a.status}`}>{a.status === "approved" ? "B2B" : STATUS_NO[a.status]}</span>{a.status === "approved" && <><br /><small className="muted">{a.activated ? "Aktivert" : "Venter på passord"}</small></>}<br /><small className="muted">{dateTime(a.created_at)}</small></td>
                <td className="num"><input className="qty-in" type="number" min={0} max={90} step="0.5" value={discount[a.id] ?? a.discount_pct} onChange={(e) => setDiscount({ ...discount, [a.id]: e.target.value })} aria-label={`Rabatt ${a.company}`} /></td>
                <td className="actions">
                  {a.status !== "approved" && <button className="btn sm" onClick={() => approve(a)}>Godkjenn</button>}
                  {a.status === "approved" && <>
                    <button className="btn sm ghost" onClick={() => act(async () => { await api(`/admin/b2b/accounts/${a.id}/discount`, { token, method: "PUT", body: { discountPct: Number(discount[a.id] ?? a.discount_pct) } }); })}>Lagre rabatt</button>
                    {!a.activated && <button className="btn sm ghost" onClick={() => approve(a)}>Ny invitasjon</button>}
                  </>}
                  {a.status !== "rejected" && <button className="btn sm ghost" onClick={() => { if (confirm(`${a.status === "approved" ? "Stenge tilgangen for" : "Avslå"} ${a.company}?`)) act(async () => { await api(`/admin/b2b/accounts/${a.id}/reject`, { token, body: {} }); }); }}>{a.status === "approved" ? "Steng" : "Avslå"}</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!data.length && <p className="muted">Ingen søknader ennå.</p>}
      </div>
    </div>
  );
}

function B2bOrders({ token, onAuth }: { token: string; onAuth: () => void }) {
  const { data, error, load, setError } = useList<B2bOrder>("/admin/b2b/orders", token, onAuth);
  const [detail, setDetail] = useState<{ order_no: number; delivery_address: string; note: string | null; phone: string; items: { sku: string; name: string; size: string | null; quantity: number; price_ore: number }[] } | null>(null);
  const move = async (id: string, status: string) => { try { await api(`/admin/b2b/orders/${id}/status`, { token, body: { status } }); await load(); } catch (e) { setError((e as Error).message); } };
  if (!data) return <p className="muted">{error || "Laster …"}</p>;
  return (
    <div>
      {error && <p className="error">{error}</p>}
      <div className="table-wrap"><table className="table">
        <thead><tr><th>Ordre</th><th>Dato</th><th>Forhandler</th><th>Status</th><th className="num">Sum eks. mva</th><th>Handling</th></tr></thead>
        <tbody>{data.map((o) => (
          <tr key={o.id}>
            <td><button className="link" onClick={async () => setDetail(await api(`/admin/b2b/orders/${o.id}`, { token }))}>BL-{o.order_no}</button>{o.reference && <><br /><small className="muted">{o.reference}</small></>}</td>
            <td>{dateTime(o.created_at)}</td><td>{o.company}<br /><small className="muted">{o.email}</small></td>
            <td><span className={`badge-s ${o.status}`}>{STATUS_NO[o.status]}</span></td><td className="num">{krDec(o.subtotal_ore)}</td>
            <td className="actions">
              {o.status === "placed" && <button className="btn sm" onClick={() => move(o.id, "confirmed")}>Bekreft</button>}
              {o.status === "confirmed" && <button className="btn sm" onClick={() => move(o.id, "shipped")}>Merk sendt</button>}
              {(o.status === "placed" || o.status === "confirmed") && <button className="btn sm ghost" onClick={() => { if (confirm(`Kansellere BL-${o.order_no}? Lageret frigis.`)) move(o.id, "cancelled"); }}>Kanseller</button>}
            </td>
          </tr>))}</tbody>
      </table>{!data.length && <p className="muted">Ingen B2B-ordre ennå.</p>}</div>
      {detail && <div className="feature detail"><h3>BL-{detail.order_no}</h3><p className="small muted">Levering: {detail.delivery_address} · Tlf. {detail.phone}{detail.note ? ` · ${detail.note}` : ""}</p><ul>{detail.items.map((i) => <li key={i.sku}>{i.name}{i.size ? ` (${i.size})` : ""} × {i.quantity} à {krDec(i.price_ore)} <small className="muted">{i.sku}</small></li>)}</ul><button className="link" onClick={() => setDetail(null)}>Lukk</button></div>}
    </div>
  );
}

function ShopOrders({ token, onAuth }: { token: string; onAuth: () => void }) {
  const { data, error, load, setError } = useList<ShopOrder>("/admin/orders", token, onAuth);
  const fulfil = async (id: string) => { try { await api(`/admin/orders/${id}/fulfil`, { token, body: {} }); await load(); } catch (e) { setError((e as Error).message); } };
  if (!data) return <p className="muted">{error || "Laster …"}</p>;
  return (
    <div className="table-wrap">
      {error && <p className="error">{error}</p>}
      <table className="table">
        <thead><tr><th>Dato</th><th>Kunde</th><th>Betaling</th><th>Levering</th><th>Status</th><th className="num">Sum inkl. mva</th><th>Handling</th></tr></thead>
        <tbody>{data.map((o) => (
          <tr key={o.id}><td>{dateTime(o.created_at)}</td><td>{o.email}</td><td>{o.provider === "vipps" ? "Vipps" : "Kort/Klarna"}</td><td>{o.delivery_method === "dealer" ? `Forhandler: ${o.dealer_id}` : "Hjemlevering"}</td>
            <td><span className={`badge-s ${o.status}`}>{STATUS_NO[o.status]}</span></td><td className="num">{kr(o.total_ore)}</td>
            <td className="actions">{o.status === "paid" && <button className="btn sm" onClick={() => fulfil(o.id)}>Merk sendt</button>}</td></tr>))}</tbody>
      </table>{!data.length && <p className="muted">Ingen ordre ennå.</p>}
    </div>
  );
}

function StockTab({ token, onAuth }: { token: string; onAuth: () => void }) {
  const [q, setQ] = useState("");
  const { data, error, load, setError } = useList<Stock>(`/admin/stock?q=${encodeURIComponent(q)}`, token, onAuth);
  const [csv, setCsv] = useState("");
  const [msg, setMsg] = useState("");
  const saveStock = async (sku: string, v: string) => { try { await api(`/admin/stock/${encodeURIComponent(sku)}`, { token, method: "PUT", body: { stock: Number(v) } }); setMsg(`Lager for ${sku} lagret.`); await load(); } catch (e) { setError((e as Error).message); } };
  const savePrice = async (sku: string, v: string) => {
    const n = v.trim() === "" ? null : Math.round(Number(v.replace(/\s/g, "").replace(",", ".")) * 100);
    if (n !== null && !Number.isFinite(n)) return setError("Ugyldig pris");
    try { await api("/admin/wholesale-prices", { token, method: "PUT", body: { prices: [{ sku, priceOre: n }] } }); setMsg(`Pris for ${sku} lagret.`); await load(); } catch (e) { setError((e as Error).message); }
  };
  async function importCsv() {
    const { prices, skipped } = parsePriceList(csv);
    if (!prices.length) return setError("Fant ingen gyldige linjer (format: SKU;pris).");
    try {
      const r = await api<{ updated: number }>("/admin/wholesale-prices", { token, method: "PUT", body: { prices } });
      setMsg(`${r.updated} priser importert${skipped ? ` (${skipped} linjer hoppet over, f.eks. overskrift)` : ""}.`); setCsv(""); setError(""); await load();
    } catch (e) { setError((e as Error).message); }
  }
  return (
    <div>
      <div className="search-box"><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Søk navn eller SKU (maks 500 rader)" aria-label="Søk" /></div>
      {error && <p className="error">{error}</p>}{msg && <p className="small muted" role="status">{msg}</p>}
      <details className="feature" style={{ marginBottom: 16 }}>
        <summary>Importer prisliste (grossistpris eks. mva)</summary>
        <p className="small muted">Én linje per SKU: <code>SKU;pris i kr</code>. Varer uten egen pris får veiledende pris eks. mva minus kundens rabatt.</p>
        <textarea rows={5} value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={"082699;18500\n080755;21990,50"} style={{ width: "100%" }} />
        <button className="btn sm" onClick={importCsv} disabled={!csv.trim()}>Importer</button>
      </details>
      {data ? (
        <div className="table-wrap"><table className="table">
          <thead><tr><th>Produkt</th><th>Str.</th><th>SKU</th><th className="num">Veil. inkl. mva</th><th className="num">Grossistpris eks. mva (kr)</th><th className="num">Lager</th></tr></thead>
          <tbody>{data.map((s) => (
            <tr key={s.sku} className={s.active ? "" : "off"}>
              <td>{s.name}</td><td>{s.size ?? "–"}</td><td className="mono">{s.sku}</td><td className="num muted">{kr(s.price_ore)}</td>
              <td className="num"><input className="qty-in" defaultValue={s.wholesale_ore == null ? "" : String(s.wholesale_ore / 100)} placeholder="rabatt" onBlur={(e) => { if (e.target.value !== (s.wholesale_ore == null ? "" : String(s.wholesale_ore / 100))) savePrice(s.sku, e.target.value); }} aria-label={`Grossistpris ${s.sku}`} /></td>
              <td className="num"><input className="qty-in" type="number" min={0} defaultValue={s.stock} onBlur={(e) => { if (Number(e.target.value) !== s.stock) saveStock(s.sku, e.target.value); }} aria-label={`Lager ${s.sku}`} /></td>
            </tr>))}</tbody>
        </table></div>
      ) : <p className="muted">Laster …</p>}
    </div>
  );
}

type ImportRow = { id: number; created_at: string; as_of: string; source: string; sender: string | null; filename: string | null; status: string; message: string | null; rows_total: number; matched: number; unmatched: number; changed: number; applied_by: string | null };
type ImportList = { autoApply: boolean; maxDropPct: number; missing: string; imports: ImportRow[] };
type ImportDetail = ImportRow & { unmatched_skus: string[]; changes: { sku: string; name: string; size: string | null; from: number; to: number }[]; changesTotal: number; totalBefore?: number; totalAfter?: number; problem: string | null };

function ImportTab({ token, onAuth }: { token: string; onAuth: () => void }) {
  const [list, setList] = useState<ImportList | null>(null);
  const [open, setOpen] = useState<ImportDetail | null>(null);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try { setList(await api<ImportList>("/admin/stock-imports", { token })); } catch (e) { if (e instanceof ApiError && e.status === 401) onAuth(); else setError((e as Error).message); }
  }, [token, onAuth]);
  useEffect(() => { load(); }, [load]);
  const show = async (id: number) => { try { setOpen(await api<ImportDetail>(`/admin/stock-imports/${id}`, { token })); setError(""); } catch (e) { setError((e as Error).message); } };
  const act = async (id: number, what: "apply" | "reject", force = false) => {
    try {
      const r = await api<{ status?: string; message?: string }>(`/admin/stock-imports/${id}/${what}`, { token, body: what === "apply" ? { force } : {} });
      setMsg(what === "apply" ? (r.message ?? "Lagret.") : "Filen er avvist.");
      setOpen(null); await load();
    } catch (e) { setError((e as Error).message); }
  };
  async function upload(f: File | undefined) {
    if (!f) return;
    try { const r = await api<{ id: number; message: string }>("/admin/stock-imports", { token, body: { filename: f.name, csvBase64: await fileToBase64(f) } }); setMsg(r.message); await load(); await show(r.id); }
    catch (e) { setError((e as Error).message); await load(); }
  }
  if (!list) return <p className="muted">{error || "Laster …"}</p>;
  return (
    <div>
      <div className="feature" style={{ marginBottom: 16 }}>
        <h3>Daglig lagerfil fra MMR</h3>
        <p className="small muted">Filer som kommer på e-post vises her. Modus: <strong>{list.autoApply ? "oppdaterer automatisk når filen består sikkerhetssjekkene" : "hver fil må godkjennes her"}</strong> · holdes tilbake ved fall i totalt lager på mer enn {list.maxDropPct} % · SKU som mangler i filen: <strong>{list.missing === "zero" ? "settes til 0" : "beholder lager"}</strong>.</p>
        <label className="btn sm ghost" style={{ cursor: "pointer" }}>Last opp CSV manuelt<input type="file" accept=".csv,text/csv" hidden onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }} /></label>
      </div>
      {error && <p className="error" role="alert">{error}</p>}{msg && <p className="small muted" role="status">{msg}</p>}
      <div className="table-wrap"><table className="table">
        <thead><tr><th>Mottatt</th><th>Fil</th><th>Kilde</th><th>Status</th><th className="num">Funnet</th><th className="num">Ukjente</th><th className="num">Endringer</th><th>Melding</th></tr></thead>
        <tbody>{list.imports.map((i) => (
          <tr key={i.id} className="click" onClick={() => show(i.id)} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && show(i.id)}>
            <td>{dateTime(i.created_at)}</td><td>{i.filename ?? "–"}</td><td>{i.source === "email" ? `E-post${i.sender ? ` (${i.sender})` : ""}` : "Opplastet"}</td>
            <td><span className={`badge-s ${i.status === "failed" ? "cancelled" : i.status === "pending" ? "placed" : i.status}`}>{{ pending: "Venter", applied: "Brukt", rejected: "Avvist", failed: "Feilet" }[i.status]}</span></td>
            <td className="num">{i.matched}</td><td className="num">{i.unmatched}</td><td className="num">{i.changed}</td><td className="small">{i.message}</td>
          </tr>))}</tbody>
      </table>{!list.imports.length && <p className="muted">Ingen filer mottatt ennå.</p>}</div>

      {open && (
        <div className="feature detail" style={{ maxWidth: "none" }}>
          <h3>{open.filename ?? `Import ${open.id}`} – {{ pending: "venter på godkjenning", applied: "brukt", rejected: "avvist", failed: "feilet" }[open.status]}</h3>
          <p className="small muted">{open.message}</p>
          {open.status === "pending" && <>
            <p>{open.changesTotal} endringer · totalt lager {open.totalBefore} → {open.totalAfter}{open.unmatched_skus.length ? ` · ${open.unmatched_skus.length} ukjente SKU` : ""}</p>
            {open.problem && <p className="error" role="alert">⚠ {open.problem}</p>}
            <div className="actions" style={{ marginBottom: 12 }}>
              <button className="btn sm" onClick={() => act(open.id, "apply")} disabled={Boolean(open.problem)}>Bruk filen</button>
              {open.problem && <button className="btn sm ghost" onClick={() => { if (confirm("Filen ser unormal ut. Bruke den likevel?")) act(open.id, "apply", true); }}>Bruk likevel</button>}
              <button className="btn sm ghost" onClick={() => act(open.id, "reject")}>Avvis</button>
            </div>
            <div className="table-wrap"><table className="table">
              <thead><tr><th>Produkt</th><th>Str.</th><th>SKU</th><th className="num">Nå</th><th className="num">Etter</th></tr></thead>
              <tbody>{open.changes.map((c) => <tr key={c.sku}><td>{c.name}</td><td>{c.size ?? "–"}</td><td className="mono">{c.sku}</td><td className="num">{c.from}</td><td className="num"><strong>{c.to}</strong></td></tr>)}</tbody>
            </table>{open.changesTotal > open.changes.length && <p className="small muted">Viser {open.changes.length} av {open.changesTotal}.</p>}</div>
          </>}
          {open.unmatched_skus.length > 0 && <details><summary className="small">Ukjente SKU ({open.unmatched_skus.length})</summary><p className="small mono">{open.unmatched_skus.slice(0, 100).join(", ")}</p></details>}
          <button className="link" onClick={() => setOpen(null)}>Lukk</button>
        </div>
      )}
    </div>
  );
}

function AddPartner({ token, onDone, onError }: { token: string; onDone: (inviteUrl: string) => void; onError: (m: string) => void }) {
  return (
    <form className="form" onSubmit={async (e) => { e.preventDefault(); const v = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
      try { const r = await api<{ inviteUrl: string }>("/admin/b2b/accounts", { token, body: { company: v.company, orgNr: v.orgNr, contactName: v.contactName, email: v.email, phone: v.phone, address: v.address, businessType: v.businessType || "Forhandler", discountPct: Number(v.discountPct || 0) } }); onDone(r.inviteUrl); }
      catch (x) { onError((x as Error).message); } }}>
      <div className="form-grid">
        <label className="field">Firmanavn *<input name="company" required /></label>
        <label className="field">Org.nr. *<input name="orgNr" required inputMode="numeric" /></label>
        <label className="field">Kontaktperson *<input name="contactName" required /></label>
        <label className="field">E-post *<input name="email" type="email" required /></label>
        <label className="field">Telefon *<input name="phone" required /></label>
        <label className="field">Adresse *<input name="address" required /></label>
        <label className="field">Type<input name="businessType" placeholder="Forhandler" /></label>
        <label className="field">Rabatt % på veil. pris eks. mva<input name="discountPct" type="number" min={0} max={90} step="0.5" defaultValue={0} /></label>
      </div>
      <button className="btn sm">Opprett og send invitasjon</button>
    </form>
  );
}

type UserRow = { id: number; email: string; name: string | null; role: string; disabled: boolean; totp_enabled: boolean; has_password: boolean; last_login_at: string | null; locked: boolean };
type AuditRow = { id: number; at: string; email: string | null; action: string; detail: Record<string, unknown>; ip: string | null };

function UsersTab({ token, onAuth, meEmail }: { token: string; onAuth: () => void; meEmail: string }) {
  const { data, error, load, setError } = useList<UserRow>("/admin/users", token, onAuth);
  const audit = useList<AuditRow>("/admin/audit", token, onAuth);
  const [link, setLink] = useState("");
  const act = async (path: string, body: unknown = {}) => { try { const r = await api<{ inviteUrl?: string }>(path, { token, body }); if (r.inviteUrl) setLink(r.inviteUrl); setError(""); await load(); await audit.load(); } catch (e) { setError((e as Error).message); } };
  if (!data) return <p className="muted">{error || "Laster …"}</p>;
  return (
    <div>
      {error && <p className="error" role="alert">{error}</p>}
      {link && <div className="notice ok"><p><strong>Invitasjonslenke</strong> (gyldig i 3 dager, kan brukes én gang). Sendt på e-post hvis e-post er satt opp – ellers send den selv:</p><p className="small" style={{ wordBreak: "break-all" }}><code>{link}</code></p><button className="link" onClick={() => setLink("")}>Lukk</button></div>}
      <form className="feature" style={{ marginBottom: 16 }} onSubmit={async (e) => { e.preventDefault(); const f = e.currentTarget; const v = Object.fromEntries(new FormData(f)) as Record<string, string>; await act("/admin/users", { email: v.email, name: v.name || undefined, role: v.role }); f.reset(); }}>
        <h3>Inviter bruker</h3>
        <div className="form-grid"><label className="field">E-post<input name="email" type="email" required /></label><label className="field">Navn<input name="name" /></label>
          <label className="field">Rolle<select name="role" defaultValue="staff"><option value="staff">Ansatt (alt unntatt brukere)</option><option value="owner">Eier (alt, inkl. brukere)</option></select></label></div>
        <button className="btn sm">Send invitasjon</button>
      </form>
      <div className="table-wrap"><table className="table">
        <thead><tr><th>Bruker</th><th>Rolle</th><th>Status</th><th>Tofaktor</th><th>Sist innlogget</th><th>Handling</th></tr></thead>
        <tbody>{data.map((u) => (
          <tr key={u.id}>
            <td>{u.name ?? "–"}<br /><small className="muted">{u.email}</small></td><td>{u.role === "owner" ? "Eier" : "Ansatt"}</td>
            <td><span className={`badge-s ${u.disabled ? "cancelled" : u.locked ? "placed" : "approved"}`}>{u.disabled ? "Deaktivert" : u.locked ? "Låst" : u.has_password ? "Aktiv" : "Invitert"}</span></td>
            <td>{u.totp_enabled ? "På" : "Ikke satt opp"}</td><td>{u.last_login_at ? dateTime(u.last_login_at) : "–"}</td>
            <td className="actions">
              <button className="btn sm ghost" onClick={() => act(`/admin/users/${u.id}/invite`)}>{u.has_password ? "Nytt passord-lenke" : "Ny invitasjon"}</button>
              {u.totp_enabled && <button className="btn sm ghost" onClick={() => { if (confirm(`Nullstille tofaktor for ${u.email}? Brukeren logges ut og setter opp på nytt.`)) act(`/admin/users/${u.id}/reset-2fa`); }}>Nullstill 2FA</button>}
              {u.locked && <button className="btn sm ghost" onClick={() => act(`/admin/users/${u.id}/unlock`)}>Lås opp</button>}
              {u.email !== meEmail && (u.disabled ? <button className="btn sm ghost" onClick={() => act(`/admin/users/${u.id}/enable`)}>Aktiver</button> : <button className="btn sm ghost" onClick={() => { if (confirm(`Deaktivere ${u.email}?`)) act(`/admin/users/${u.id}/disable`); }}>Deaktiver</button>)}
            </td>
          </tr>))}</tbody>
      </table></div>
      <details className="feature" style={{ marginTop: 16 }}><summary>Aktivitetslogg (siste 200)</summary>
        <div className="table-wrap"><table className="table"><thead><tr><th>Tid</th><th>Bruker</th><th>Handling</th><th>Detaljer</th><th>IP</th></tr></thead>
          <tbody>{(audit.data ?? []).map((a) => <tr key={a.id}><td>{dateTime(a.at)}</td><td>{a.email ?? "–"}</td><td className="mono">{a.action}</td><td className="small">{Object.keys(a.detail).length ? JSON.stringify(a.detail) : ""}</td><td className="small">{a.ip}</td></tr>)}</tbody></table></div>
      </details>
    </div>
  );
}

function MyAccount({ token, onNewToken }: { token: string; onNewToken: (t: string) => void }) {
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  return (
    <form className="form narrow" onSubmit={async (e) => { e.preventDefault(); const f = e.currentTarget; const v = Object.fromEntries(new FormData(f)) as Record<string, string>; setError(""); setMsg("");
      if (v.next !== v.confirm) return setError("Passordene er ikke like.");
      try { const r = await api<{ token: string }>("/admin/auth/change-password", { token, body: { current: v.current, next: v.next } }); onNewToken(r.token); setMsg("Passordet er endret. Andre innloggede økter er logget ut."); f.reset(); } catch (x) { setError((x as Error).message); } }}>
      <h2>Endre passord</h2>
      <label className="field">Nåværende passord<input name="current" type="password" required autoComplete="current-password" /></label>
      <label className="field">Nytt passord (minst 12 tegn)<input name="next" type="password" required minLength={12} autoComplete="new-password" /></label>
      <label className="field">Gjenta nytt passord<input name="confirm" type="password" required minLength={12} autoComplete="new-password" /></label>
      {error && <p className="error" role="alert">{error}</p>}{msg && <p role="status">{msg}</p>}
      <button className="btn">Lagre</button>
      <p className="small muted">Mistet telefonen? En eier kan nullstille tofaktor for deg under «Brukere».</p>
    </form>
  );
}
