# Cloudflare Pages Deployment Notes — Lumina

## STATUS

TEST PREVIEW

This deployment is for preview/testing only. It is not the final public business launch.

## Deployment method

Manual Cloudflare Dashboard upload only.

Do not use Wrangler.
Do not use API keys.
Do not request or store Cloudflare secrets.

Manual path:

Cloudflare Dashboard → Workers & Pages → Pages → Upload assets

## Project settings

- Cloudflare Pages project name: `lumina`
- Custom domain: `lumina.qutaifan.com`
- Deployment folder: `Q:\world\Projects\Lumina\website`
- Build command: none
- Output directory: `/`

## Preview notes

- Website can be shared for design and user-flow feedback.
- WhatsApp number is intentionally a placeholder.
- Display phone is intentionally a placeholder.
- Contact buttons are not final.
- Do not treat this as final business launch.
- Do not run ads yet.
- Real contact number must be added before final launch.

## Static site structure

Upload the contents of:

`Q:\world\Projects\Lumina\website`

Required files/folders:

- `index.html`
- `listings.html`
- `property-details.html`
- `css/style.css`
- `js/site.js`
- `assets/images/`
- `copy/`
- `sitemap.md`
- `design-notes.md`
- `CLOUDFLARE_PAGES_DEPLOYMENT.md`

## Manual upload checklist

1. Open Cloudflare Dashboard.
2. Go to Workers & Pages.
3. Open Pages.
4. Create/select project: `lumina`.
5. Choose Upload assets.
6. Upload the folder contents from `Q:\world\Projects\Lumina\website`.
7. Set build command to none.
8. Set output directory to `/`.
9. Deploy.
10. Add custom domain: `lumina.qutaifan.com`.
11. Confirm DNS/custom domain status is active in Cloudflare.
12. Share only as TEST PREVIEW.
13. Replace placeholder contact number before final public launch.

## Post-deploy test URLs

Check these after deployment:

- `https://lumina.qutaifan.com/`
- `https://lumina.qutaifan.com/index.html`
- `https://lumina.qutaifan.com/listings.html`
- `https://lumina.qutaifan.com/property-details.html`
- `https://lumina.qutaifan.com/css/style.css`
- `https://lumina.qutaifan.com/js/site.js`
- `https://lumina.qutaifan.com/assets/images/hero-luxury-villa.jpg`

## Test-preview contact configuration

Placeholders are intentionally allowed during TEST PREVIEW:

- WhatsApp: `https://wa.me/9627XXXXXXXX`
- Phone: `+962 7X XXX XXXX`
- Email: `lumina@qutaifan.com`

## Security note

Any Cloudflare Global API Key pasted during testing should be rotated immediately.

Future CLI deployments, if ever needed, should use scoped Cloudflare API Tokens only — not Global API Keys.

For this test preview deployment, use manual Cloudflare Dashboard upload only.
