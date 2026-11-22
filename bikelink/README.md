# Bikelink – new shop

Replacement for the Shopify store at bikelink.no.

- `design/`  – Figma links and design notes (design is approved before `web/` is built)
- `web/`     – storefront (planned: Next.js + TypeScript)
- `backend/` – API: products, checkout, orders, payment webhooks (Fastify + Postgres)

## Payments
| Method | How |
|---|---|
| Card, Klarna | Stripe Checkout (methods are switched on in the Stripe dashboard) |
| Vipps | Vipps ePayment API, called directly |

Rules the code follows:
1. Prices are integers in øre. The server computes totals from the database; the browser never sends a price.
2. An order is only marked `paid` after the server has confirmed the payment with Stripe or Vipps (signed webhook / re-fetched status).
3. Webhooks are idempotent: handling the same event twice is harmless.

## Run the backend
```
cd backend
cp .env.example .env     # fill in keys
npm install
psql "$DATABASE_URL" -f sql/schema.sql
npm run dev
```

## Storefront (web/)
Next.js, fully static (SSG) – every page is plain HTML for crawlers and AI agents.
```
cd web && npm install
npm run import     # refresh data/products.json from the live Shopify store
npm run dev
```
SEO / AI-search features: JSON-LD (Organization, WebSite, Product+Offer, BreadcrumbList, CollectionPage/ItemList),
canonical URLs, sitemap.xml, robots.txt (AI crawlers allowed), `/llms.txt`, Google Merchant feed `/feed.xml`.

## 360° product view
Put a numbered image sequence in `web/public/spin/<product-handle>/` (`01.webp` … `36.webp`, 24–36 frames, same framing, bike centred
on a plain background). The product page then shows a drag / swipe / arrow-key viewer automatically. No folder = normal gallery.

## Checkout wiring
Cart (browser) → `POST {NEXT_PUBLIC_API_URL}/checkout` with `{ provider, email, delivery, items: [{ sku, quantity }] }`.
The backend re-prices every SKU from Postgres. Load the catalogue with `cd backend && npm run seed`.
Seed sets stock to 1 for available variants (Shopify's public feed has no stock counts) – load real stock before launch.

## Back-office API, email, redirects, tests, deploy

**Admin API** (disabled unless `ADMIN_TOKEN` is set; `Authorization: Bearer <token>`):
`GET /admin/orders?status=paid` · `GET /admin/orders/:id` · `POST /admin/orders/:id/fulfil` · `PUT /admin/stock/:sku {"stock": 3}`

**Order emails**: set `SMTP_URL` (+ `MAIL_FROM`) and a Norwegian confirmation is sent the first time an order is confirmed paid.

**Old Shopify URLs**: `npm run redirects` (web) rebuilds `data/redirects.json` from the live sitemap. `/products/*` → `/sykkel/*` (same handles),
31 collections → matching category/family, duplicate listings → the original. Pages that are not migrated yet
(`/pages/b2b`, `/pages/bike-exchange`, `/policies/*`) must stay on the old shop or be rebuilt before the domain moves.

**Tests**: `cd web && npm test` (data rules: unique SKUs, no internal notes, no duplicate models, redirects valid).
`cd backend && DATABASE_URL=postgres://…/bikelink_test npm test` (API against real Postgres; refuses databases not named *test*).
CI: `.github/workflows/bikelink.yml`.

**Run everything locally**: `cp backend/.env.example backend/.env` (fill keys) → `docker compose up --build` → `docker compose run --rm seed`.
(Dockerfiles/compose are written but have not been run in this environment.)

## Catalogue facts (found during import)
- 71 Shopify products = 69 real products + 2 duplicate listings (`…-copy`, `…-1`). Only 5 are real colour variants of another product; they are
  grouped under one card with a colour switcher. All other products are separate model/spec levels (Aelion 00/10/30/50 …).
- 7 products had internal admin notes as their public description (never shown by the new site, see `needsReview`).
- 3 variants had no SKU and 14 shared SKUs; the export makes SKUs unique. Fix them in Shopify too.

## ⚠ Legal texts need review before launch
`web/data/legal/*.json` is the live Shopify text, copied verbatim (`npm run import:pages` re-imports it). After the move the facts change:
- **Personvern**: describes Shopify as the platform/data controller. The new stack is Cloudflare (hosting/CDN), Railway (database), Stripe, Klarna, Vipps and your SMTP provider – list them as processors.
- **Vilkår**: names "Move Forward Holding" as operator while the site footer says BikeLink AS (org.nr. 935 095 034 MVA) – confirm the correct legal entity.
- **Juridisk merknad**: talks about a cookie consent flow. The new site sets no tracking cookies (the cart uses the browser's localStorage); if you add analytics, add a consent banner and update the text.
- **Frakt**: carriers listed (Posten, PostNord, FedEx, DHL) – confirm they match what you will actually use.
Have these read by whoever is responsible for legal/compliance.

## B2B dealer portal and back-office
**Dealers** (`/b2b`): apply at `/b2b/soknad` → staff approve in `/admin` and set a discount % → dealer gets an email link to choose a password
(`/b2b/aktiver`, valid 7 days, single use) → logs in at `/b2b/logg-inn` → `/b2b/portal`: catalogue with the dealer's prices **excl. VAT**,
live stock, order form (reference, delivery address, note), order history. Orders reserve stock at once; settlement is by invoice (no online payment).
Forgot password: `/b2b/glemt`.

**Prices:** `retail incl. VAT ÷ 1.25 × (1 − dealer discount)`, unless a wholesale price exists for the SKU (override). Load a real price list in
`/admin` → *Lager og priser* → *Importer prisliste* (`SKU;price in kr excl. VAT` per line, semicolon or tab).

**Back-office** (`/admin`, not indexed): paste `ADMIN_TOKEN` once per browser tab. Tabs: B2B accounts (approve / reject / change discount / re-invite),
B2B orders (confirm → shipped / cancel returns stock), web-shop orders (mark shipped), stock and wholesale prices.
If email (`SMTP_URL`) is not set up, the approve step shows the invite link so you can send it yourself.

Security notes: passwords are scrypt-hashed; login tokens are HS256 JWTs valid 12 h, kept in sessionStorage; closing an account blocks its token immediately;
login/apply/forgot are rate limited; forgot-password never reveals whether an email exists; `/admin` is only as strong as `ADMIN_TOKEN` (long random value) –
for staff with individual logins, add accounts before the team grows.
Env: `JWT_SECRET` (required for B2B), `B2B_NOTIFY_EMAIL` (default info@bikelink.no).

## Daily stock file from MMR (CSV by email)
MMR's daily email → CSV attachment → **import** → stock in the database → shown live on the site and in the dealer portal.

1. **Receive** – either (A) a Cloudflare Email Worker (`email-worker/`) on a dedicated address, or (B) an IMAP poller (`npm run stock:poll`) that reads a mailbox
   (works with your one.com mailbox, no DNS change). Both only accept senders in `STOCK_ALLOWED_SENDERS`.
2. **Read** – encoding (UTF-8 / Windows-1252), delimiter (`;` `,` tab `|`) and the SKU/quantity columns are detected automatically
   (English, Spanish and Norwegian header names; override with `STOCK_SKU_COLUMN` / `STOCK_QTY_COLUMN`). SKUs match even if Excel dropped a leading zero.
3. **Check** – a file is *held for review* if it would cut total stock by more than `STOCK_MAX_DROP_PCT` (60 %), matches no product, or (with `STOCK_MISSING=zero`) covers
   less than half of the products. Unreadable files are stored as "failed" and staff get an email.
4. **Approve** – `/admin` → *Lagerimport*: see exactly what changes (before → after), then *Bruk filen* / *Avvis*. With `STOCK_AUTO_APPLY=true` files that pass the checks apply by themselves
   (start with `false` for a week or two).
5. **Orders in between** – units sold since the file was sent (paid web orders, open dealer orders) are subtracted, because the file cannot know about them.
6. **Show** – product pages check the live stock in the browser (a sold-out size cannot be added to the cart; "Kun N igjen" at 3 or fewer); the public API only says "10+";
   the dealer portal shows "Lager sist oppdatert …"; every applied import triggers a rebuild (`DEPLOY_HOOK_URL`) and `npm run build` pulls current availability (`scripts/sync-stock.mjs`).

Open questions to confirm with the first real file: which SKU column MMR uses, whether the quantity is BikeLink's own warehouse or MMR's central stock, and whether the file lists every SKU.

## Not migrated (needs a decision)
- **Multiple users per dealer / credit limits / payment terms / returns**: one login per dealer account for now.
- **People photos**: dealer/staff portraits on the old site were not copied (photos of identifiable people – get permission first).
