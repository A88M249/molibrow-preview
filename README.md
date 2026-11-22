# molibrow-preview
Molí Brow Studio website mockups

## Studio site (`/studio`)
Multi-page, SEO-ready site (42 pages): Norwegian at the root, English under `/en/`, plus Norwegian-only Akershus area pages under `/omrader/`.

- Copy: `tools/site_content.py` (services, prices, FAQs, NO + EN) and `tools/areas_content.py` (Akershus area pages, privacy, booking copy). Home body: `tools/templates/home_main.html`.
- Build: `SITE_URL=https://your-domain.no python3 tools/build_site.py` regenerates every page, `sitemap.xml`, `robots.txt` and `404.html` into `studio/`.
- Photos: `python3 tools/studio_grade.py` colour-grades the originals into one studio look (`studio/img`).
- Motion: GSAP 3 + ScrollTrigger, self-hosted in `studio/assets/vendor`; logic in `studio/assets/site.js`. Content stays visible without JS, with reduced-motion, or if GSAP fails to load.
- Preview: `cd studio && python3 -m http.server`.
- Deploy: publish the `studio/` folder as the site root (the 404 page and manifest assume root hosting).

### Booking provider
Default is Timma (`BOOKING_PROVIDER=timma`): every "Bestill time" button links to Timma.
To switch to the native booking page backed by Spokes (`/bestill/`, `/en/book/`):

```
BOOKING_PROVIDER=spokes SPOKES_SLUG=<workshop slug in Spokes> TURNSTILE_SITEKEY=<site key allowed for the domain> \
SITE_URL=https://your-domain.no python3 tools/build_site.py
```
Optional: `SPOKES_API` (default `https://api.spokes.no`), `SPOKES_APP` (default `https://app.spokesworkshop.com`, used for the "view your booking" link).
The page (`studio/assets/booking.js`) uses Spokes' public endpoints under `/v1/public/bbk/w/:slug/` (`info`, `availability`, `dropoff`, `booking`) and falls back to Timma if the API or workshop is unavailable.
