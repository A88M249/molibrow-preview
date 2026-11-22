# Design

**Figma:** https://www.figma.com/design/AHTDUW5BmISu17hc6qp1PV  (BikeLink.no – Web design)

| Figma page | Content |
|---|---|
| Foundations | logos, warm-grey palette, type scale (Geist + Geist Mono), buttons |
| Desktop – 1280 | Home, Home + mega-meny, Kategori, Produkt, Produkt 360°, Handlekurv/betaling, Finn forhandler, Service, Om oss, Kontakt |
| Mobile – 390 | Home, Meny, Kategori, Produkt, Handlekurv |

The desktop/mobile frames were captured from the built site, so they are editable layers (text, auto-sized frames, images).
The 360° frame shows the viewer UI with a single photo – real spin photos are needed (see `web/public/spin/`).

## Design direction (v2)
Inspired by polymer.ws: full-bleed lifestyle photography, header that is transparent over the hero, mono "+" navigation with a
mega menu, small corner captions, product slider with prev/next buttons, warm greys with a single red accent.

## Lifestyle photography
`web/public/life/*.webp` are frames taken from BikeLink's own MMR hero film (road cycling only, 1920x1080).
Register new photos in `web/src/lib/life.ts`. Gravel, MTB, e-bike and kids' categories do not have lifestyle photos yet –
they show product images until real photography exists (ask MMR for their media kit, or shoot with a dealer).
