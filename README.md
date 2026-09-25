# R-CASH — Fintech Repayment Website

Independent rebuild inspired by the public structure/flow of a R-CASH-style repayment portal.

## Included
- Responsive fintech landing page
- Google OAuth login using Google Identity Services
- Language selector
- News / system cards
- Payment guide
- Security notice
- Customer payment form
- Confirmation / QR placeholder
- Receipt upload UI
- Payment submitted screen
- Privacy and Terms template pages

## Files
- `index.html`
- `style.css`
- `script.js`
- `auth.js`
- `privacy-policy.html`
- `terms-and-conditions.html`
- `assets/rcash-logo.png`
- `.nojekyll`

## Google OAuth setup
1. Configure the OAuth client ID in Google Cloud Console.
2. Add the production domain to the OAuth client's authorized JavaScript origins.
3. Keep the Google client ID in `auth.js`; it is a public client identifier.
4. Do not place client secrets, private keys, service-account JSON, payment gateway secrets, or banking credentials in this public repository.

`auth.js` uses Google Identity Services and does not use Firebase Authentication. The legacy email/password controls are removed at runtime for compatibility with older copies of `index.html`.

## Payment gateway
The QR in this template is a visual placeholder. A real automatic "payment successful" trigger requires a payment provider/backend/webhook. Do not rely on a receipt upload alone to mark a transaction as successful.

## Deploy on GitHub Pages
1. Upload the files at repository root.
2. Settings → Pages → Deploy from branch.
3. Select the default branch / root.
4. Add the custom domain only after DNS records are ready.
