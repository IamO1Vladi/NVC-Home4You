# Add & Swap Kit — SPA SEO + GTM + Consent (Vite + React)

This folder contains files you can drop into your project. Update placeholders like:
- Domain: `https://www.example.com`
- Google Tag Manager ID: `GTM-XXXXXXX`

## What to replace
1. **`index.html`** — replace your Vite HTML entry with the one here (adds GTM + Consent Mode defaults).
2. **`src/main.jsx`** — replaces HashRouter with BrowserRouter and adds:
   - `GtmPageviewListener` (pushes `page_view` events on SPA nav).
   - `ConsentBanner` (Accept/Reject wired to Consent Mode).

> Save a copy of your originals before replacing.

## What to add
- `src/GtmPageviewListener.jsx`
- `src/components/ConsentBanner.jsx`
- `public/robots.txt`
- `public/sitemap.xml` (or generate with the script below)
- Hosting rewrite file (choose one):
  - **Netlify**: `public/_redirects`
  - **Vercel**: `vercel.json` at project root
  - **Apache**: `.htaccess` at web root
  - **Nginx**: merge `nginx.conf` snippet into your server config

## GTM setup (once)
1. Create a **Web** container at tagmanager.google.com and copy your ID (e.g., `GTM-ABC1234`).
2. In GTM:
   - Create **GA4 Configuration** tag with your Measurement ID (G-XXXX…). Trigger: **All Pages**.
   - Create **GA4 Event** tag named `page_view`:
     - Event name: `page_view`
     - Trigger: **All Pages** (or a Custom Event = `page_view`, if you prefer)
     - Parameters: `page_location`, `page_path`, `page_title` mapped from Data Layer variables.
   - (Optional but recommended) Create **Consent Update** tags for `consent_accept` / `consent_reject` if you want to log consent events.
   - You can also add Google Ads tags; they will respect Consent Mode.

Consent defaults are **denied** in `index.html` before GTM loads. When the user accepts, we call
`gtag('consent','update', ...)` to grant `ad_storage`, `analytics_storage`, `ad_user_data`, and `ad_personalization`.

> If you run personalized ads in the EEA/UK, use a **Google‑certified CMP** for full compliance.

## Sitemap generation (optional)
Install once: `npm i -D sitemap`

Then run: `node scripts/generate-sitemap.mjs`  
It writes `public/sitemap.xml` with the URLs you list in the script.

## After deployment
- Visit `https://YOUR_DOMAIN/robots.txt` and `https://YOUR_DOMAIN/sitemap.xml`
- Submit the sitemap in Google Search Console.
- Check that routes load directly (no 404) — rewrites must be active.
