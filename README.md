# ShopScout

ShopScout is a private product comparison workspace for people who research products across multiple stores. It captures product listings, normalizes messy specs into comparable fields, flags duplicates and weak data, and helps make buying decisions with side-by-side tables or optional AI analysis.

## What ShopScout Does

- Captures product facts from shopping pages on demand.
- Saves products into named local lists for later reference.
- Builds comparison tables from captured specs, pricing, seller data, ratings, identifiers, and notes.
- Normalizes values so filters, sorting, and comparisons work across inconsistent retailer data.
- Supports manual AI prompts and connected AI provider workflows.
- Exports selected product data to clipboard or files.

## Capture Coverage

ShopScout includes dedicated adapters for Amazon, eBay, and Walmart. A generic adapter handles other product pages when they expose usable structured data or visible product facts.

The extension avoids always-on scraping. Product extraction runs when the user captures, rescans, or adds products from open tabs.

## Normalization Examples

Retailer and marketplace data is inconsistent. ShopScout uses deterministic local normalization before display and matching:

| Raw listing values | Normalized value |
| --- | --- |
| `9 volts_of_direct_current`, `9 V` | `9 V` |
| `23.6 inches`, `60 cm` | `60 cm` or local display units |
| `Black&red` | `Black`, `Red` |
| `USB-C`, `usb type c`, `Type-C` | `USB-C` |

ShopScout cross-references local rules with industry vocabulary sources including Shopify product taxonomy, Google Product Taxonomy, a GS1 GPC subset, Icecat category/attribute libraries, and Amazon ESCI substitute-signal data. These sources inform comparison and matching; they do not automatically merge or delete products.

## AI Workflows

- **Auto AI** uses a configured provider API key and runs inside ShopScout.
- **Manual AI** creates a prompt that can be used in ChatGPT, Claude, Gemini, Perplexity, or another assistant.
- **Paste result back** lets ShopScout store and apply supported AI corrections to the active list.

## Privacy

ShopScout is not a store, ad network, or price-affiliate service. It does not send browsing history to ShopScout servers. Saved lists stay in the browser's local product database unless the user exports them or chooses to send selected product facts to an AI provider.

## Development

```powershell
npm test
npm run syntax
npm run lint
npm run typecheck
npm run build
```

