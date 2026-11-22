# bikelink.no – analysis of the current Shopify store (22 Nov 2026)

## The business
Official Norwegian importer/distributor of **MMR Bikes** (Spain). Sells online, delivers to home **or** to a local MMR dealer ("Hent hos forhandler"), and runs a dealer finder + workshop booking ("Bestill verksted"). Norwegian only, NOK, prices incl. VAT, shipping included.

## Catalogue (from /products.json)
- 71 products, 394 variants (299 in stock). Vendor: MMR Bikes.
- Price: 3 990 – 119 990 NOK, median 37 990 NOK. High-ticket, considered purchase.
- Types: Road 22, MTB hardtail 13, E-bikes 17, Gravel 11, MTB full-suspension 6, Kids 2.
- Options: Størrelse (size) on 69 products; colour is named inconsistently (`COLOR`, `Farge`, `Color`). Each colourway is its own product ("MMR Lyth 10 Void"), so the same model is split over many products.
- 31 collections (per model family, e.g. Adrenaline, Aelion, X-Grip, Kenta, Lyth) plus category collections and "Tour de France sale".

## Current site
- Theme: Shopify **Prestige**. Fonts Jost + Poppins, wide-tracked uppercase headings.
- Homepage: announcement bar → video hero → title → USPs → categories → featured collections → model families → "why" → help → about → newsletter → SEO text.
- Product page: gallery, colour swatch, size, stock, delivery choice (home / dealer), add to cart, **Klarna** ("Fra 3 542 kr/md") and **Vipps** badges. Size guide exists.
- Tracking: Google tag only. No review app, no Stripe in the page.

## What works (keep)
- Clear positioning ("Offisiell distributør") and Norwegian copy.
- Delivery choice home vs dealer – this is core to the business.
- Klarna and Vipps visible near the buy button.
- Strong ride imagery; clean product photos on light grey.

## Problems (fix in redesign)
1. Header nav wraps onto two lines on desktop ("OM OSS" drops down); hero text over the nav is low-contrast.
2. Newsletter popup opens over the hero on first load, on desktop and mobile, covering the main call-to-action.
3. Mobile hero is a dark empty screen before the video loads; second button is hidden by the popup.
4. Heavy page: homepage HTML alone is ~720 KB; many sections, long scrolling.
5. Uppercase + wide letter-spacing on long headings and prices ("84.990,00 NOK") hurts readability; price formatting is not Norwegian-standard (should be "84 990 kr").
6. Model and colour are split into separate products and inconsistent option names → hard to compare, bad filtering, messy SEO.
7. No visible comparison, spec table, filters (frame size, budget, e-assist) or sizing help on the way to the product.
8. No reviews or trust signals (warranty, returns, test rides) near the price.
9. Pricing is shown with 394 variants but there is no stock-by-dealer view.

## Implications for the new build
- Data model: **Model → Colourways → Size variants**, plus **Dealers** (address, pickup, service) and per-order delivery method (home / dealer pickup). Backend needs a `dealers` table and `orders.delivery` fields.
- Payments: card + Klarna via Stripe, Vipps direct (already in the backend scaffold). Consider Klarna monthly-price display on product pages (calculated client-side).
- Import: 71 products / 394 variants from products.json (images on cdn.shopify.com), 31 collections → URL redirects from `/products/*` and `/collections/*` to keep SEO.
- Design: modern, calm, high-end bike-brand look; sentence-case headings, Norwegian price format, sticky buy box, filters, dealer finder as a first-class feature, no popup on first load.
