# Store assets

Images for the Google Workspace Marketplace listing (see
[`../marketplace-listing.md`](../marketplace-listing.md) §3). Nothing here is
pushed to Apps Script.

| File | Use |
| --- | --- |
| `sefarrow-32.png` | Marketplace application icon, 32 × 32. The same image as the manifest `logoUrl`. |
| `sefarrow-128.png` | Marketplace application icon, 128 × 128; OAuth consent-screen logo. |
| `sefarrow-256.png` | Source artwork at 256 × 256 (white background). |
| `sefarrow-64-transparent.png` | The in-app "Open on Sefaria" icon: a transparent crop of the 256 px artwork, embedded as a data: URI in `apps-script/css/layout.html`. |
| `card-banner-220x140.png` | Marketplace application card banner. |

To change the in-app icon, regenerate the transparent PNG and replace the
`url(...)` in the `.open-sefaria-icon` rule in `apps-script/css/layout.html`.
