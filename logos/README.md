# ShopScout Logo Cache

This folder is reserved for future curated SVG logo assets.

Current runtime behavior:

- ShopScout does **not** render logo images in the product grid.
- `Brand` and `Source` cells render readable text tokens only.
- The previous cached SVG files were removed because asset-level SVG sizing kept producing inconsistent measured dimensions.

Do not add logo files back unless the grid logo-image feature is explicitly restored.

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

- None.
