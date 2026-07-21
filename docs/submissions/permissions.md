# ShopScout Extension Permissions

ShopScout requests only the permissions needed for user-initiated capture, side-panel display, local storage, and context-menu actions.

## Permissions

| Permission | Reason |
|---|---|
| `activeTab` | Lets ShopScout read the active tab when the user clicks capture. |
| `storage` | Stores lists, settings, provider configuration, and local workflow state. |
| `unlimitedStorage` | Prevents browser extension storage quota failures for large product lists and generated normalization context. |
| `scripting` | Injects the capture script on demand for supported product pages. |
| `tabs` | Reads current-window tabs for "Add Products from Open Tabs" and opens product/dashboard pages. |
| `contextMenus` | Adds user-triggered right-click capture and AI prompt options. |
| `sidePanel` | Chrome and Edge only. Opens ShopScout in the browser side panel. |

## Host Permissions

ShopScout currently declares `<all_urls>` because product capture is user-initiated and must support both known retailers and generic product pages. The manifest content script match list is still limited to known shopping hosts where automatic page detection is useful.

## Capture Boundary

ShopScout does not continuously scrape all pages. Product extraction runs when the user captures, rescans, adds a URL, or adds products from open tabs.

