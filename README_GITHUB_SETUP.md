# Racing Calendar — GitHub Pages package (V62 iPhone base)

Repository: https://github.com/Loac13/Calendar
Expected published URL: https://loac13.github.io/Calendar/

## First deployment

1. Unzip the package on the Lenovo.
2. Open the repository and select **Add file > Upload files**.
3. Upload the **files inside this folder**, not the ZIP itself. Upload `index.html`, `sw.js`, `manifest.webmanifest`, `icon-180.png`, `icon-192.png`, `icon-512.png`. `.nojekyll` is optional.
4. Select **Commit changes** on the `main` branch.
5. Open repository **Settings > Pages** and select **Deploy from a branch**, `main`, `/(root)`, **Save**.
6. Once GitHub Pages shows the site URL, open it in Safari on your iPhone. Share > Add to Home Screen > Open as Web App > Add.

## What currently works

- iPhone-friendly calendar and full desktop V62 features.
- Local saving on the device, and JSON export/import for backups.
- Offline access after first load.
- Application updates deploy automatically from the repository when you publish changed files. The service worker now checks for a fresh HTML page when online instead of always using the old cached copy.

## What is NOT configured yet

**iPhone-to-Lenovo DATA synchronization does not work yet.** GitHub Pages serves static application files; it is not a private database. We still need a separate authenticated database (e.g. Supabase), synchronization/conflict handling, and migration of your existing local data. Never upload private calendar JSON, tariff details, credentials or API service-role secrets to a PUBLIC GitHub repository. Anon Supabase keys may be client-side only if Row Level Security and authentication are correctly configured.

**AI-driven deployment is not connected yet.** Updating files in ChatGPT does not push them to GitHub on its own. Use a compatible authorized GitHub write workflow, or manually upload the reviewed files/commit them to the repository. After such a push, GitHub Pages updates automatically.

If you installed an earlier PWA from another host, install the GitHub Pages URL as a new web app. Existing local data stored on a different origin does not transfer automatically; export a JSON backup from the earlier app and import it into this one first.
