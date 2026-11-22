# molibrow-preview
Molí Brow Studio website mockups

## Studio site (`/studio`)
One-page site with a photo-studio look (seamless backdrop, framed prints with crop marks, contact-sheet gallery).
Photos are colour-graded for one consistent look by `python3 tools/studio_grade.py` (originals untouched, output in `studio/img`).
Preview: `python3 -m http.server` then open `/studio/`.
