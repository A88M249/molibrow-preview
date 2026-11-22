function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
}

/** Per-route rate limits are multiplied by this (default 1). Tests raise it so they can log in many times quickly. */
export const rateLimit = (max: number) => ({ config: { rateLimit: { max: max * Number(process.env.RATE_LIMIT_MULTIPLIER ?? 1), timeWindow: "1 minute" } } });

const opt = (name: string): string | undefined => process.env[name] || undefined;

export const config = {
  // Signs dealer login tokens. Without it the B2B portal is disabled (503).
  jwtSecret: opt("JWT_SECRET"),
  stock: {
    // Shared secret for POST /ingest/stock (used by the Cloudflare Email Worker). Without it that endpoint is off.
    ingestToken: opt("STOCK_INGEST_TOKEN"),
    // Who may send stock files by email: full addresses or "@domain" entries, comma-separated. Required for email intake.
    allowedSenders: (process.env.STOCK_ALLOWED_SENDERS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
    // true = apply files that pass the safety checks without a human click; false = every file waits for approval in /admin.
    autoApply: process.env.STOCK_AUTO_APPLY === "true",
    // Refuse (hold for review) if the total stock would fall by more than this share.
    maxDropPct: Number(process.env.STOCK_MAX_DROP_PCT ?? 60),
    // What to do with SKUs that are not in the file. MMR's daily file only lists what MMR has, so a missing SKU means "none available": zero (default).
    // "keep" leaves their stock alone. Either way a file that covers less than half of the products is held for review.
    missing: (process.env.STOCK_MISSING === "keep" ? "keep" : "zero") as "keep" | "zero",
    skuColumn: opt("STOCK_SKU_COLUMN"),
    qtyColumn: opt("STOCK_QTY_COLUMN"),
    notifyEmail: opt("STOCK_NOTIFY_EMAIL") ?? process.env.B2B_NOTIFY_EMAIL ?? "info@bikelink.no",
    // Called after a stock update is applied (e.g. a Cloudflare/Vercel deploy hook) so the static site refreshes.
    deployHook: opt("DEPLOY_HOOK_URL"),
  },
  b2bNotifyEmail: opt("B2B_NOTIFY_EMAIL") ?? "info@bikelink.no",
  // Browsers may call the API from the main site and from preview/www hosts (comma-separated).
  corsOrigins: [process.env.SITE_URL, ...(process.env.ALLOWED_ORIGINS ?? "").split(",")].map((o) => o?.trim().replace(/\/$/, "")).filter((o): o is string => Boolean(o)),
  mail: { smtpUrl: opt("SMTP_URL"), from: opt("MAIL_FROM") ?? "BikeLink <info@bikelink.no>" },
  port: Number(process.env.PORT ?? 4000),
  siteUrl: need("SITE_URL"),
  databaseUrl: need("DATABASE_URL"),
  stripe: {
    secretKey: need("STRIPE_SECRET_KEY"),
    webhookSecret: need("STRIPE_WEBHOOK_SECRET"),
  },
  vipps: {
    baseUrl: need("VIPPS_BASE_URL"),
    clientId: need("VIPPS_CLIENT_ID"),
    clientSecret: need("VIPPS_CLIENT_SECRET"),
    subscriptionKey: need("VIPPS_SUBSCRIPTION_KEY"),
    msn: need("VIPPS_MSN"),
  },
};
