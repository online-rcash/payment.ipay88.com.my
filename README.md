# R-CASH — Fintech Repayment Website

Independent rebuild inspired by the public structure/flow of a R-CASH-style repayment portal.

## Included
- Responsive fintech landing page
- Google / Email Firebase-ready login
- Demo login fallback before Firebase is configured
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
- `firebase-config.js`
- `auth.js`
- `privacy-policy.html`
- `terms-and-conditions.html`
- `assets/rcash-logo.png`
- `.nojekyll`

## Firebase setup
1. Create/select a Firebase project.
2. Authentication → Sign-in method → enable Google and Email/Password.
3. Authentication → Settings → Authorized domains → add your domain.
4. Project Settings → Your apps → Web app → copy config.
5. Paste only the Firebase **web config** into `firebase-config.js`.

Never place:
- service account private keys
- admin passwords
- payment gateway secret keys
- banking credentials
inside public GitHub Pages JavaScript.

## Payment gateway
The QR in this template is a visual placeholder. A real automatic "payment successful" trigger requires a payment provider/backend/webhook. Do not rely on a receipt upload alone to mark a transaction as paid.

## Change branding
Branding is already set to R-CASH.

Main logo: `assets/rcash-logo.png`

## Deploy on GitHub Pages
1. Create a new repository.
2. Upload all files at repository root.
3. Settings → Pages → Deploy from branch.
4. Select `main` / root.
5. Add your custom domain only after DNS records are ready.
