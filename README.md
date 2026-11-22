# molibrow-preview
Molí Brow Studio website mockups

## Studio site (`/studio`)
Multi-page, SEO-ready site (28 pages: Norwegian at the root, English under `/en/`) with a photo-studio look.

- Copy: `tools/site_content.py` (all services, prices, FAQs, NO + EN). Home body: `tools/templates/home_main.html`.
- Build: `SITE_URL=https://your-domain.no python3 tools/build_site.py` regenerates every page, `sitemap.xml`, `robots.txt` and `404.html` into `studio/`.
- Photos: `python3 tools/studio_grade.py` colour-grades the originals into one studio look (`studio/img`).
- Preview: `cd studio && python3 -m http.server`.
- Deploy: publish the `studio/` folder as the site root (the 404 page and manifest assume root hosting).
