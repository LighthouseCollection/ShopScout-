# ShopScout Release Readiness Checklist

## Required Validation

- [ ] `npm test`
- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm run syntax`
- [ ] `npm run build`

## Browser Smoke Tests

- [ ] Chrome package loads unpacked from `dist/chrome`.
- [ ] Edge package loads unpacked from `dist/edge`.
- [ ] Firefox package loads temporarily from `dist/firefox`.
- [ ] Product capture succeeds on Amazon.
- [ ] Product capture succeeds on eBay.
- [ ] Product capture succeeds on Walmart.
- [ ] Generic adapter captures a non-supported product page without junk UI images.
- [ ] Add Products from Open Tabs works in the current window.
- [ ] Dashboard opens from the popup or side panel.
- [ ] Settings opens inside dashboard content.
- [ ] Manual AI prompt can be generated.
- [ ] Auto AI onboarding appears when no provider is configured.

## Store Materials

- [ ] `docs/submissions/copy.md`
- [ ] `docs/submissions/permissions.md`
- [ ] `docs/legal/privacy-policy.md`
- [ ] `docs/legal/terms.md`
- [ ] `docs/legal/third-party-licenses.md`
- [ ] Browser-specific setup docs
- [ ] Browser-specific icon folders
- [ ] Screenshots captured from the final v1 UI

## Versioning

Current extension version is read from `manifest.json`, `manifest.firefox.json`, and `package.json`. Keep those aligned before publishing.

