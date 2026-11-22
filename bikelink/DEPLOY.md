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

## 6b. Daily stock email from MMR
Pick one way to receive the mail (both feed the same importer; start with `STOCK_AUTO_APPLY=false` so you approve each file in `/admin` → *Lagerimport*).

On the API (Railway) set: `STOCK_ALLOWED_SENDERS` (MMR's sending address, e.g. `stock@mmr.example` or `@mmr.example` – ask MMR / look at a past email), and `DEPLOY_HOOK_URL`
(Cloudflare: Workers & Pages → the Worker → Settings → Builds → Deploy hooks; add `NEXT_PUBLIC_API_URL` to the build variables so every build pulls current stock).

**A. Cloudflare Email Worker** (needs Cloudflare DNS, step 1)
1. Pick a *sub*domain for stock mail, e.g. `lager.bikelink.no`, so your normal mailbox/MX records are untouched. Cloudflare → Email → Email Routing → *Settings* → add the subdomain
   (Cloudflare adds its MX records for that subdomain only).
2. Email Routing → *Destination addresses*: add and verify `info@bikelink.no` (used as fallback for non-stock mail or while the API is down).
3. `cd email-worker && npm install && npx wrangler secret put STOCK_INGEST_TOKEN && npx wrangler deploy` (adjust `API_URL` / `FALLBACK_ADDRESS` in `wrangler.jsonc` first).
   Use the same long random `STOCK_INGEST_TOKEN` on the API.
4. Email Routing → *Routing rules* → custom address `stock@lager.bikelink.no` → *Send to a Worker* → `bikelink-stock-mail`.
5. Tell MMR to send the daily file to `stock@lager.bikelink.no` – or, if it must stay at the current address, add an automatic forward rule in that mailbox.

**B. IMAP poller** (no DNS or MMR change; works with the mailbox that gets the mail today)
1. Create a dedicated mailbox / app password at one.com and make sure MMR's mail lands in its INBOX (forward rule if needed).
2. On Railway add a service from the same repo (root `bikelink/backend`, same variables) with start command `npm run build && npm run stock:poll` and a **cron schedule** of every 30 minutes.
3. Variables: `IMAP_HOST` (one.com: `imap.one.com`), `IMAP_USER`, `IMAP_PASSWORD`, optional `IMAP_MAILBOX`, `IMAP_PROCESSED_MAILBOX`. Only mail from `STOCK_ALLOWED_SENDERS` is touched.

Check the first real file: `/admin` → *Lagerimport* shows the detected columns and the before/after list. If the columns are not recognised, the error lists the headers it found.
Neither the Email Worker routing nor the IMAP poller has been run against a real mail server yet – do the first test with a copy of a real MMR email.

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
