# Deploying bikelink.no (domain stays at one.com)

**Idea:** keep the domain registered at one.com and only change its DNS records. The site runs on hosts built for Node.js.
(one.com's standard web hosting is aimed at static/PHP/WordPress sites, so don't run this app there.)

| Part | Where | Why |
|---|---|---|
| Storefront (`web/`) | **Vercel** (Hobby/Pro) | Next.js is built for it; static pages on a CDN |
| API + Postgres (`backend/`) | **Railway** or **Fly.io**, EU region | Node server + managed Postgres in one place |
| Domain + email | **one.com** (unchanged) | Only DNS records are edited |

Names used below: site `bikelink.no` / `www.bikelink.no`, API `api.bikelink.no`, preview `ny.bikelink.no`.

## 0. Before you start (important)
- **Do not touch MX / TXT / SPF / DKIM records at one.com.** `info@bikelink.no` email probably runs through them.
  Only change the records listed in step 5.
- Keep Shopify live until the new site is tested. Nothing below breaks the current shop until step 5.
- Lower the TTL of the current A/CNAME records to 300 s a day before the cutover (one.com → DNS settings).

## 1. Database + API (Railway example)
1. New project → **PostgreSQL** (region EU, e.g. Amsterdam) → copy `DATABASE_URL`.
2. New service from this GitHub repo, root directory `bikelink/backend` (it has a Dockerfile).
3. Environment variables (see `backend/.env.example`):
   `DATABASE_URL`, `SITE_URL=https://bikelink.no`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
   `VIPPS_BASE_URL=https://api.vipps.no`, `VIPPS_CLIENT_ID`, `VIPPS_CLIENT_SECRET`, `VIPPS_SUBSCRIPTION_KEY`, `VIPPS_MSN`,
   `ADMIN_TOKEN` (long random), `SMTP_URL`, `MAIL_FROM`.
4. Create the tables and load the catalogue once, from your computer:
   ```
   psql "$DATABASE_URL" -f backend/sql/schema.sql
   cd backend && DATABASE_URL=... npm run seed
   ```
5. Set real stock: `PUT https://api.bikelink.no/admin/stock/<sku>` with `{"stock": n}` (Bearer `ADMIN_TOKEN`).
6. Add the custom domain `api.bikelink.no` in Railway (it shows the CNAME target).

## 2. Payments
- **Stripe:** Dashboard → Developers → Webhooks → endpoint `https://api.bikelink.no/webhooks/stripe`, events
  `checkout.session.completed` and `checkout.session.async_payment_succeeded`. Copy the signing secret to `STRIPE_WEBHOOK_SECRET`.
  Settings → Payment methods: enable **Cards** and **Klarna** (NOK).
- **Vipps:** portal.vipps.no → Vipps ePayment → get client id/secret, subscription key and MSN. Register the callback URL
  `https://api.bikelink.no/webhooks/vipps`. Test first with `VIPPS_BASE_URL=https://apitest.vipps.no`.
- Do a real test order in Stripe test mode and the Vipps test environment before going live.

## 3. Storefront (Vercel)
1. Import the GitHub repo, **Root Directory = `bikelink/web`**.
2. Environment variables: `NEXT_PUBLIC_SITE_URL=https://bikelink.no`, `NEXT_PUBLIC_API_URL=https://api.bikelink.no`.
3. Deploy. You get a `*.vercel.app` preview URL: click through every page, add a bike to the cart, run a test payment.
4. Add the domain `ny.bikelink.no` to the project for a branded preview (step 4).

## 4. Preview on a subdomain (safe, Shopify untouched)
At one.com → *DNS-innstillinger* for bikelink.no add:

| Type | Name | Value |
|---|---|---|
| CNAME | `ny` | `cname.vercel-dns.com` |
| CNAME | `api` | *(target shown by Railway)* |

Vercel/Railway show the exact values when you add the domain; use theirs if they differ from the table.
Set `NEXT_PUBLIC_SITE_URL=https://ny.bikelink.no` while previewing, and `robots: noindex` stays on (set `SITE_URL` back before launch).

## 5. Cutover (do it at a quiet hour)
1. Final data refresh: `cd web && npm run import && npm run redirects`, commit, let Vercel redeploy.
2. Set `NEXT_PUBLIC_SITE_URL=https://bikelink.no`, redeploy.
3. At one.com change **only** these records:

   | Type | Name | New value |
   |---|---|---|
   | A | `@` (bikelink.no) | `76.76.21.21` |
   | CNAME | `www` | `cname.vercel-dns.com` |

   Remove the old Shopify A/CNAME for the same names (they point at Shopify's `23.227.38.65` / `shops.myshopify.com`).
4. Add `bikelink.no` and `www.bikelink.no` in Vercel (www redirects to the apex). HTTPS certificates are issued automatically.
5. Check: home, a product, cart → test order, `https://bikelink.no/products/<old-handle>` redirects, `/sitemap.xml`, `/robots.txt`, `/llms.txt`.
6. Submit `https://bikelink.no/sitemap.xml` in Google Search Console and Bing Webmaster Tools.
7. In Shopify, keep the store (and its payment settings) for 30 days as a fallback; remove the domain from Shopify once you are happy.

**Rollback:** put the old A/CNAME values back at one.com (with TTL 300 s this takes minutes).

## 6. Still on the old shop at launch
These pages only exist on Shopify today and will 404 on the new domain until rebuilt: `/pages/b2b`, `/pages/bike-exchange`,
`/policies/terms-of-service`, `/policies/refund-policy`, `/policies/shipping-policy`, `/policies/privacy-policy`, `/policies/legal-notice`.
The footer links to them. **Move them before step 5** (legal pages are required for a Norwegian web shop: terms, returns, shipping, privacy, cookies).

## Costs to expect (check current prices)
Vercel Hobby is free but not for commercial use; Pro is per seat. Railway/Fly are usage-based (a small API + Postgres is typically a few dollars a month).
Stripe, Klarna and Vipps charge per transaction.
