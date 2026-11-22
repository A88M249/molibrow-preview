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
