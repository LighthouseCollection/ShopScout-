# Microsoft Edge Add-ons Setup

## Package

Run:

```powershell
npm run build
```

Upload:

```text
dist/edge
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
docs/submissions/assets/edge
```

Screenshots should show:

- Side-panel capture
- Product table view
- Product detail view
- AI analysis workflow
- Settings

## Pre-Submission Checklist

- `npm test`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- Confirm Edge package loads unpacked.
- Confirm side panel opens with correct height.
- Confirm permissions shown by Edge match `docs/submissions/permissions.md`.

