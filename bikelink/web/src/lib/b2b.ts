// Browser-side helpers for the dealer portal and the back office. Tokens live in sessionStorage (cleared when the tab closes).
export const API = process.env.NEXT_PUBLIC_API_URL;
export const DEALER_KEY = "bikelink-b2b-token";
export const ADMIN_KEY = "bikelink-admin-token";

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

const flatten = (e: unknown): string => {
  if (typeof e === "string") return e;
  if (e && typeof e === "object") {
    const o = e as Record<string, unknown>;
    if (o.fieldErrors) return Object.entries(o.fieldErrors as Record<string, string[]>).map(([k, v]) => `${k}: ${v.join(", ")}`).join("; ");
    return Object.values(o).map(flatten).filter(Boolean).join("; ");
  }
  return "";
};

export async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown; token?: string | null } = {}): Promise<T> {
  if (!API) throw new ApiError(0, "Portalen er ikke koblet til en server ennå (NEXT_PUBLIC_API_URL mangler).");
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      method: opts.method ?? (opts.body ? "POST" : "GET"),
      headers: { ...(opts.body ? { "content-type": "application/json" } : {}), ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}) },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Fikk ikke kontakt med serveren. Prøv igjen.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, res.status === 429 ? "For mange forsøk. Vent litt og prøv igjen." : flatten((data as { error?: unknown }).error) || `Feil (${res.status})`);
  return data as T;
}

export const getToken = (key: string) => { try { return sessionStorage.getItem(key); } catch { return null; } };
export const setToken = (key: string, v: string | null) => { try { v ? sessionStorage.setItem(key, v) : sessionStorage.removeItem(key); } catch { /* private mode */ } };

export const kr = (ore: number) => `${new Intl.NumberFormat("nb-NO").format(Math.round(ore / 100)).replace(/ /g, " ")} kr`;
export const krDec = (ore: number) => `${new Intl.NumberFormat("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(ore / 100).replace(/ /g, " ")} kr`;
export const dateTime = (iso: string) => new Date(iso).toLocaleString("nb-NO", { dateStyle: "short", timeStyle: "short" });
export const STATUS_NO: Record<string, string> = { placed: "Mottatt", confirmed: "Bekreftet", shipped: "Sendt", cancelled: "Kansellert", pending: "Venter", approved: "Godkjent", rejected: "Avslått", paid: "Betalt", fulfilled: "Sendt" };

/**
 * Parses a pasted price list: one "SKU;price in kr excl. VAT" per line (semicolon or tab, decimal comma or point).
 * A header line or any line without a valid price is skipped; the result lists how many were skipped.
 */
export function parsePriceList(text: string): { prices: { sku: string; priceOre: number }[]; skipped: number } {
  const prices: { sku: string; priceOre: number }[] = [];
  let skipped = 0;
  for (const line of text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)) {
    const [sku, raw = ""] = line.split(/[;\t]/).map((x) => x.trim());
    const kr = Number(raw.replace(/\s/g, "").replace(",", "."));
    if (!sku || raw === "" || !Number.isFinite(kr) || kr < 0) { skipped++; continue; }
    prices.push({ sku, priceOre: Math.round(kr * 100) });
  }
  return { prices, skipped };
}

export const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(new Error("Kunne ikke lese filen."));
    r.readAsDataURL(file);
  });

/** Tell the rest of the page that the dealer signed in or out (the price provider reloads). */
export const announceDealerChange = () => { try { window.dispatchEvent(new Event("bikelink-dealer-change")); } catch { /* ignore */ } };
export const dealerLogout = () => { setToken(DEALER_KEY, null); try { sessionStorage.removeItem("bikelink-b2b-catalog"); } catch { /* ignore */ } announceDealerChange(); };
