# Firefox Add-ons Setup

## Package

Run:

```powershell
npm run build
```

Upload:

```text
dist/firefox
```

Firefox uses `action.default_popup` instead of the Chromium side panel.

## Store Fields

- Name: ShopScout
- Category: Shopping
- Short description: use `docs/submissions/copy.md`
- Full description: use `docs/submissions/copy.md`
- Privacy policy: use `docs/legal/privacy-policy.md`
- Support email: FrRaphaelMaher@gmail.com

## Assets

Use icons from:

```text
docs/submissions/assets/firefox
```

Screenshots should show:

- Popup capture view
- Comparison dashboard
- Normalization review
- Manual AI prompt flow
- Settings

## Pre-Submission Checklist

- `npm test`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- Confirm Firefox package loads temporarily in `about:debugging`.
- Confirm background script path uses `manifest.firefox.json`.

