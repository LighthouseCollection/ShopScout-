# ShopScout Logo Cache

This folder stores curated SVG logo assets used by the product grid for `Brand` and `Source` cells.

Runtime behavior:

- ShopScout renders packaged files from this folder first, for example `logos/amazon.svg`.
- If a packaged logo is missing or fails to load, the grid falls back to provider URLs from the adapter.
- If all SVG candidates fail, the readable brand or source text is shown instead.
- Files in this folder are kept and reused so the extension does not have to search for the same logo every time.

Preferred provider order for new assets:

1. `theSVG.org`
2. `svglogos.dev`
3. `WorldVectorLogo`
4. Other provider only after verifying the asset is a real logo and not a provider placeholder.

Asset rules:

- Prefer SVG.
- Prefer rectangular / horizontal wordmarks when available.
- Keep each logo proportional; do not force every SVG into an exact 80 x 24 shape.
- The UI places each logo inside a consistent slot capped at 80px wide and 24px high.

Licensing note:

Logo files may represent third-party trademarks. Before adding new production assets, verify the source license and usage terms for that specific logo.

Current packaged assets:

- `amazon.svg` — retrieved from theSVG CDN after rectangular CDN candidates were unavailable.
- `microsoft.svg` — retrieved from WorldVectorLogo CDN.
- `logitech.svg` — retrieved from WorldVectorLogo CDN.
- `newegg.svg` — retrieved from theSVG CDN after rectangular CDN candidates were unavailable.
