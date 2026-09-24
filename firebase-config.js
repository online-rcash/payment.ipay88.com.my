/*
  Firebase configuration
  ----------------------
  1. Create/select your Firebase project.
  2. Enable Authentication > Sign-in method:
     - Google
     - Email/Password
  3. Add your website domain under Authentication > Settings > Authorized domains.
  4. Replace the placeholders below with your own Firebase web app config.

  IMPORTANT:
  Firebase web config values are client identifiers, but NEVER place server secrets,
  service-account JSON, private keys, payment gateway secret keys or admin credentials here.
*/

window.R-CASH_FIREBASE_CONFIG = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.firebasestorage.app",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
