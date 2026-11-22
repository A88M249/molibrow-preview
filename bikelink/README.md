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
