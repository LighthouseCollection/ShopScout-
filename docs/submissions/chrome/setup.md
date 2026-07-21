# Chrome Web Store Setup

## Package

Run:

```powershell
npm run build
```

Upload:

```text
dist/chrome
```

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
docs/submissions/assets/chrome
```

Screenshots should show:

- Capture side panel
- Product comparison dashboard
- Manual AI prompt flow
- AI Results view
- Settings > AI Providers

## Pre-Submission Checklist

- `npm test`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- Confirm Chrome package loads unpacked with no manifest errors.
- Confirm product capture works on a supported product page.
- Confirm dashboard opens from the side panel icon.

