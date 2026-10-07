# R-Cash: Google, Email OTP dan Magic Link

Frontend telah dikemas kini. Email OTP dan Magic Link menggunakan:
https://otp-sender.spring-truth-635c.workers.dev

Backend baharu belum dipasang ke Cloudflare. Tiada email sebenar dihantar semasa ujian setempat.

## 1. Pasang jadual D1

Cloudflare > D1 > database yang terikat sebagai AUTH_DB > Console.
Jalankan kandungan `schema.sql`. Arahan CREATE TABLE IF NOT EXISTS tidak memadam data.
Jadual sedia ada mesti mempunyai kolum yang digunakan oleh kod asal termasuk `cancelled`.
Dua jadual baharu ialah `email_magic_links` dan `email_magic_sessions`.

## 2. Deploy kod Workers

Cloudflare > Workers & Pages > otp-sender > Edit code.
Gantikan modul pengesahan lama dengan `rcash-email-auth-worker.mjs`, kemudian Deploy.
Fail ini mempunyai export default untuk Worker OTP standalone.
Jika Worker juga menjalankan API lain, gunakan handleEmailAuth dalam fetch sedia ada dan kekalkan route lain. Jangan gantikan keseluruhan Worker yang mempunyai API lain dengan entry standalone.

## 3. Semak bindings dan variables

Kekalkan secrets Mailjet, OTP_PEPPER dan TURNSTILE_SECRET_KEY yang sudah ada.
Binding D1: AUTH_DB.
MAIL_FROM_EMAIL: alamat sender yang telah disahkan dalam Mailjet.
MAIL_FROM_NAME: R-Cash.
TURNSTILE_ACTION: auth.
SESSION_TTL_SECONDS: 3600 (disyorkan).
ALLOWED_ORIGINS: https://www.rcash.my,https://rcash.my,https://www.r-cash.my,https://r-cash.my,https://duitjom-repo-copy.muhamadshafiq5463.chatgpt.site
Masukkan hanya domain website yang awak gunakan; padam domain yang tidak digunakan.
Jika ALLOWED_ORIGINS lama masih ditetapkan, ia mengatasi senarai lalai dalam kod.

Dalam Turnstile, benarkan hostname website awak dan hostname projek ChatGPT jika menguji di projek tersebut. Sitekey frontend mesti sepadan dengan secret Worker.

WELCOME_EMAIL_ENABLED=true mengaktifkan email welcome selepas pengesahan. Kekalkan cron asal untuk retry dan cleanup. UNIQUE(email,kind) dalam jadual outbox mengelakkan email welcome berulang; jika jadual lama mempunyai struktur lain, semak struktur itu sebelum mengaktifkan welcome.

## 4. Google Login

Google menggunakan konfigurasi Firebase asal dalam firebase-config.js.
Firebase Console > Authentication > Settings > Authorized domains: tambah domain website awak dan domain projek jika perlu. Google provider mesti diaktifkan.
Sesi Google dan sesi email Worker berasingan. Jika API pelanggan dilindungi menggunakan requireEmailSession, sesi Google sahaja belum memberi akses ke API tersebut; backend API itu perlu mengesahkan Firebase ID token untuk pengguna Google. Kod ini tidak mengubah perlindungan API pembayaran.

## 5. Upload website ke GitHub Pages

Upload SEMUA kandungan folder `dist/` ke root repository website. index.html mesti berada di root.
Jangan upload backend, tests atau secrets ke folder frontend yang disajikan.
URL Workers ditetapkan dalam auth/worker-config.js.

## 6. Uji dengan email awak

Login with Email > isi email > lengkapkan Turnstile > Hantar OTP.
Masukkan enam digit; sistem mengesahkan automatik dan membuka borang pelanggan.
OTP sah 5 minit; hantar semula selepas 60 saat.

Login Passwordless (Magic Link) > isi email > lengkapkan Turnstile > Hantar Magic Link.
Buka pautan email, kemudian tekan butang pengesahan pada website.
Pautan sah 10 minit dan sekali guna. Klik pengesahan diperlukan supaya scanner email tidak terus menggunakan pautan.

Backend menyimpan hash token. Frontend menyimpan token sesi dalam sessionStorage supaya sesi email boleh berfungsi antara domain website dan workers.dev tanpa bergantung pada cookie pihak ketiga. Token sesi hilang apabila tab ditutup; Mailjet secrets kekal dalam Worker.

## Pengesahan yang sudah dijalankan

node --check auth/app-auth.js
node --check backend/rcash-email-auth-worker.mjs
node --test backend/tests/auth.test.mjs

Ujian D1/Turnstile/Mailjet menggunakan adapter setempat dan respons olok-olok. Ujian ini bukan bukti email sebenar telah diterima atau konfigurasi Cloudflare sudah betul.
