# Deploying bikelink.no – Cloudflare (web + DNS) and Railway (API + database)

| Part | Where | Notes |
|---|---|---|
| DNS, HTTPS, CDN, DDoS protection | **Cloudflare** (Free plan) | the domain stays *registered* at one.com; only its nameservers move |
| Storefront (`web/`) | **Cloudflare Workers** | Next.js via the OpenNext adapter; tested locally in the Workers runtime |
| API + Postgres (`backend/`) | **Railway** (or Fly.io), EU region | Node + Postgres; a rewrite for Workers is possible later |
| Email (`info@bikelink.no`) | unchanged | the MX/SPF/DKIM records must be copied to Cloudflare DNS (step 1) |

Names: site `bikelink.no` / `www.bikelink.no`, API `api.bikelink.no`, preview `ny.bikelink.no`.

## 0. Read first
- **Email:** when nameservers move, *all* DNS records must exist at Cloudflare, or mail and the Shopify shop stop working.
- **DNSSEC:** if DNSSEC is switched on for bikelink.no at one.com, turn it **off before** changing nameservers, then re-enable it
  at Cloudflare (DNS → Settings → DNSSEC, add the DS record at one.com). Skipping this can take the domain offline.
- **Shopify and Cloudflare proxy:** Shopify does not support domains proxied through Cloudflare. Until cutover keep the Shopify
  records (apex A, `www` CNAME) as **DNS only** (grey cloud).
- Keep Shopify live until the new site is tested.

## 1. Move DNS to Cloudflare (no downtime if done carefully)
1. Create a Cloudflare account → **Add a domain** → `bikelink.no` → Free plan. Cloudflare scans and imports existing records.
2. Open one.com → *DNS settings* for bikelink.no in another tab and compare **every** record, including `MX`, `TXT` (SPF, DKIM,
   DMARC, verification codes) and any mail `CNAME`s. Add what is missing. Set mail-related records to **DNS only**.
3. At one.com change the domain's nameservers to the two Cloudflare nameservers shown. Activation usually takes minutes to a few hours.
4. When Cloudflare says *Active*, send and receive a test email to `info@bikelink.no`.

## 2. Database + API (Railway example)
1. New project → **PostgreSQL** (EU region) → copy `DATABASE_URL`.
2. New service from the GitHub repo, root directory `bikelink/backend` (it has a Dockerfile).
3. Variables (`backend/.env.example`): `DATABASE_URL`, `SITE_URL=https://bikelink.no`,
   `ALLOWED_ORIGINS=https://www.bikelink.no,https://ny.bikelink.no,https://bikelink-web.<your-account>.workers.dev`,
   `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `VIPPS_BASE_URL=https://api.vipps.no`, `VIPPS_CLIENT_ID`,
   `VIPPS_CLIENT_SECRET`, `VIPPS_SUBSCRIPTION_KEY`, `VIPPS_MSN`, `ADMIN_TOKEN` (long random), `SMTP_URL`, `MAIL_FROM`.
4. Create tables and load the catalogue once from your computer:
   ```
   psql "$DATABASE_URL" -f backend/sql/schema.sql
   cd backend && DATABASE_URL=... npm run seed
   ```
5. Real stock and dealer prices: open `https://bikelink.no/admin` (paste `ADMIN_TOKEN`) → *Lager og priser* (edit stock per SKU, import the wholesale price list).
   First dealers: *B2B-kontoer* → approve applications (the invite link is shown if email is not set up yet).
6. In Railway add custom domain `api.bikelink.no`; in Cloudflare DNS add the CNAME Railway shows, **DNS only** (grey cloud).

## 3. Payments
- **Stripe:** Developers → Webhooks → `https://api.bikelink.no/webhooks/stripe`, events `checkout.session.completed` and
  `checkout.session.async_payment_succeeded`; put the signing secret in `STRIPE_WEBHOOK_SECRET`. Settings → Payment methods:
  enable Cards and Klarna (NOK).
- **Vipps:** portal.vipps.no → ePayment: client id/secret, subscription key, MSN. Callback `https://api.bikelink.no/webhooks/vipps`.
  Test first with `VIPPS_BASE_URL=https://apitest.vipps.no`.
- Run a full test order in Stripe test mode and Vipps test before going live.

## 4. Storefront on Cloudflare Workers
The Worker serves pre-rendered pages from its static assets; no database or image server is needed (product photos are resized by
Shopify's CDN, see `src/lib/image-loader.ts`).

**Option A – from your computer (first deploy):**
```
cd bikelink/web
npx wrangler login
NEXT_PUBLIC_SITE_URL=https://ny.bikelink.no NEXT_PUBLIC_API_URL=https://api.bikelink.no npm run cf:deploy
```
**Option B – automatic on every push:** Cloudflare dashboard → Workers & Pages → Create → import the GitHub repo.
Root directory `bikelink/web`; build command `npx opennextjs-cloudflare build`; deploy command `npx opennextjs-cloudflare deploy`
(this also uploads the pre-rendered page cache); build variables `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_API_URL`, `NODE_VERSION=22`.
(Check the field names in the dashboard; they change occasionally.)

`NEXT_PUBLIC_*` values are baked in at build time: change them → redeploy.

## 5. Preview on `ny.bikelink.no` (Shopify untouched)
Worker → Settings → Domains & Routes → **Add custom domain** `ny.bikelink.no` (Cloudflare creates the DNS record).
Click through every page, add a bike to the cart, do a test payment, check `https://ny.bikelink.no/products/<old-handle>` redirects.
While previewing, the site is indexable only on the final domain: set `NEXT_PUBLIC_SITE_URL` back to `https://bikelink.no` for launch.

## 6. Cutover (quiet hour)
1. Refresh data: `cd web && npm run import && npm run redirects`, commit, redeploy with `NEXT_PUBLIC_SITE_URL=https://bikelink.no`.
2. In Cloudflare DNS **delete** the Shopify records for `bikelink.no` (A `23.227.38.65`) and `www` (CNAME `shops.myshopify.com`).
3. Worker → Domains & Routes → add `bikelink.no` and `www.bikelink.no`. HTTPS certificates are issued automatically.
4. Rules → Redirect Rules: `www.bikelink.no/*` → `https://bikelink.no/${1}` (301). SSL/TLS → *Always Use HTTPS* on.
5. Check: home, a product, cart → test order, old URLs redirect, `/sitemap.xml`, `/robots.txt`, `/llms.txt`, email still works.
6. Submit `https://bikelink.no/sitemap.xml` to Google Search Console and Bing Webmaster Tools.
7. Keep the Shopify store (and payment settings) for ~30 days as a fallback.

**Rollback:** remove the Worker custom domains, re-add the Shopify A/CNAME (DNS only). Cloudflare applies DNS changes in seconds.

## 7. Still on the old shop at launch
These exist only on Shopify and will 404 on the new domain until rebuilt: `/pages/b2b`, `/pages/bike-exchange`,
`/policies/terms-of-service`, `/policies/refund-policy`, `/policies/shipping-policy`, `/policies/privacy-policy`, `/policies/legal-notice`.
The footer links to them. **Rebuild them before step 6** – terms, returns, shipping, privacy and cookies are required for a Norwegian web shop.

*(Update: all of these are rebuilt in the new site and redirect from the old URLs; the B2B portal is now `/b2b` with login at `/b2b/logg-inn`.)*

## Costs (check current prices)
Cloudflare Free covers DNS/CDN; Workers has a free allowance and a low-cost paid plan for more traffic. Railway/Fly are usage-based
(a small API + Postgres is typically a few dollars a month). Stripe, Klarna and Vipps charge per transaction.

## Alternatives
Vercel instead of Cloudflare Workers also works (set Root Directory `bikelink/web`; the same env vars). Moving the API to Workers
(Hono + Hyperdrive + an external Postgres such as Neon) is possible later; it is not needed to launch.
