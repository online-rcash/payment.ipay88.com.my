(() => {
  const status = document.querySelector("#authStatus");
  const googleBtn = document.querySelector("#googleLoginBtn");
  const form = document.querySelector("#emailAuthForm");
  const registerBtn = document.querySelector("#registerBtn");

  function setStatus(message, type = "info") {
    if (!status) return;
    status.textContent = message;
    status.style.color = type === "error" ? "#ff9e9e" : type === "success" ? "#35f28b" : "#ffd479";
  }

  function configReady(config) {
    return config &&
      config.apiKey &&
      !config.apiKey.startsWith("YOUR_") &&
      config.authDomain &&
      !config.authDomain.startsWith("YOUR_");
  }

  const config = window.R-CASH_FIREBASE_CONFIG;

  // Demo mode keeps the template testable before Firebase is configured.
  if (!window.firebase || !configReady(config)) {
    setStatus("Firebase belum dikonfigurasi — demo login aktif.");

    googleBtn?.addEventListener("click", () => {
      localStorage.setItem("rcash-demo-session", "1");
      window.RCashUI?.showApp();
    });

    form?.addEventListener("submit", (event) => {
      event.preventDefault();
      localStorage.setItem("rcash-demo-session", "1");
      window.RCashUI?.showApp();
    });

    registerBtn?.addEventListener("click", () => {
      localStorage.setItem("rcash-demo-session", "1");
      window.RCashUI?.showApp();
    });

    if (localStorage.getItem("rcash-demo-session") === "1") {
      window.addEventListener("DOMContentLoaded", () => window.RCashUI?.showApp());
    }

    window.RCashAuth = {
      signOut: async () => {
        localStorage.removeItem("rcash-demo-session");
        window.RCashUI?.showAuth();
      }
    };
    return;
  }

  firebase.initializeApp(config);
  const auth = firebase.auth();
  const provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  googleBtn?.addEventListener("click", async () => {
    setStatus("Opening Google sign-in...");
    try {
      await auth.signInWithPopup(provider);
      setStatus("Signed in successfully.", "success");
    } catch (error) {
      console.error(error);
      setStatus(error.message || "Google sign-in failed.", "error");
    }
  });

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = document.querySelector("#authEmail")?.value.trim();
    const password = document.querySelector("#authPassword")?.value || "";

    try {
      await auth.signInWithEmailAndPassword(email, password);
      setStatus("Signed in successfully.", "success");
    } catch (error) {
      console.error(error);
      setStatus(error.message || "Email sign-in failed.", "error");
    }
  });

  registerBtn?.addEventListener("click", async () => {
    const email = document.querySelector("#authEmail")?.value.trim();
    const password = document.querySelector("#authPassword")?.value || "";

    if (!email || password.length < 6) {
      setStatus("Masukkan email dan password sekurang-kurangnya 6 aksara.", "error");
      return;
    }

    try {
      await auth.createUserWithEmailAndPassword(email, password);
      setStatus("Account created successfully.", "success");
    } catch (error) {
      console.error(error);
      setStatus(error.message || "Account registration failed.", "error");
    }
  });

  auth.onAuthStateChanged((user) => {
    if (user) {
      window.RCashUI?.showApp();
    } else {
      window.RCashUI?.showAuth();
    }
  });

  window.RCashAuth = {
    signOut: () => auth.signOut()
  };
})();
