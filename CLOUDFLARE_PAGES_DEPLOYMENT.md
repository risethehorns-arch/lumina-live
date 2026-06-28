# Cloudflare Pages Deployment Notes — Lumina

## STATUS

TEST PREVIEW

This deployment is for preview/testing only. It is not the final public business launch.

## Deployment method

GitHub-connected Cloudflare Pages deployment.

Cloudflare Pages should deploy from the GitHub repository `Qutaifan/lumina-website` whenever changes are pushed to the `main` branch.

Do not use Wrangler.
Do not use Cloudflare API keys.
Do not request or store Cloudflare secrets.

Cloudflare path:

Cloudflare Dashboard → Workers & Pages → Pages → Create project → Connect to Git → GitHub → Select `lumina-website`

## Project settings

- GitHub repo: `Qutaifan/lumina-website`
- Cloudflare Pages project name: `lumina`
- Production branch: `main`
- Framework preset: None
- Build command: none
- Output directory: `/`
- Custom domain: `lumina.qutaifan.com`

## Preview notes

- Website can be shared for design and user-flow feedback.
- WhatsApp number is intentionally a placeholder.
- Display phone is intentionally a placeholder.
- Contact buttons are not final.
- Do not treat this as final business launch.
- Do not run ads yet.
- Real contact number must be added before final launch.

## Static site structure

Repository root contains the static website files directly.

Required files/folders:

- `index.html`
- `listings.html`
- `property-details.html`
- `css/style.css`
- `js/site.js`
- `assets/images/`
- `assets/data/`
- `copy/`
- `sitemap.md`
- `design-notes.md`
- `CLOUDFLARE_PAGES_DEPLOYMENT.md`

## GitHub deployment checklist

1. Open Cloudflare Dashboard.
2. Go to Workers & Pages.
3. Open Pages.
4. Create/select project: `lumina`.
5. Choose Connect to Git.
6. Select GitHub repository: `Qutaifan/lumina-website`.
7. Set production branch: `main`.
8. Set framework preset: None.
9. Set build command to none / blank.
10. Set output directory to `/`.
11. Deploy.
12. Add custom domain: `lumina.qutaifan.com`.
13. Confirm DNS/custom domain status is active in Cloudflare.
14. Share only as TEST PREVIEW.
15. Replace placeholder contact number before final public launch.

## Post-deploy test URLs

Check these after deployment:

- `https://lumina.qutaifan.com/`
- `https://lumina.qutaifan.com/index.html`
- `https://lumina.qutaifan.com/listings.html`
- `https://lumina.qutaifan.com/property-details.html`
- `https://lumina.qutaifan.com/css/style.css`
- `https://lumina.qutaifan.com/js/site.js`
- `https://lumina.qutaifan.com/assets/images/demo-dabouq-villa-01.jpg`

## Test-preview contact configuration

Placeholders are intentionally allowed during TEST PREVIEW:

- WhatsApp: `https://wa.me/9627XXXXXXXX`
- Phone: `+962 7X XXX XXXX`
- Email: `lumina@qutaifan.com`

## Security note

Do not commit or store Cloudflare API keys, GitHub tokens, owner private contact details, or `.env` files.

For this test-preview deployment, use Cloudflare's GitHub integration only.
