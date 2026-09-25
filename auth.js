(() => {
  "use strict";

  const GOOGLE_CLIENT_ID =
    "246834525616-hlbjha10qjgi4cp6tpgdrisqe2fajrte.apps.googleusercontent.com";

  const status = document.querySelector("#authStatus");
  const googleBtn = document.querySelector("#googleLoginBtn");
  const emailToggleBtn = document.querySelector("#toggleEmailBtn");
  const emailForm = document.querySelector("#emailAuthForm");
  const divider = document.querySelector(".divider");

  let currentUser = null;
  let currentCredential = null;

  function setStatus(message = "", type = "info") {
    if (!status) return;

    status.textContent = message;
    status.style.color =
      type === "error" ? "#ff9e9e" :
      type === "success" ? "#35f28b" :
      "#ffd479";
  }

  // Google OAuth is the only supported authentication method.
  // Keep legacy email elements hidden if an older index.html still contains them.
  function hideEmailLogin() {
    [emailToggleBtn, emailForm, divider].forEach((element) => {
      if (element) element.remove();
    });
  }

  function decodeJwtPayload(token) {
    try {
      const payload = token.split(".")[1];
      const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
      const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
      const binary = atob(padded);
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      return JSON.parse(new TextDecoder().decode(bytes));
    } catch (error) {
      console.error("Gagal membaca Google ID token:", error);
      return null;
    }
  }

  function handleGoogleCredential(response) {
    if (!response?.credential) {
      setStatus("Log masuk Google tidak berjaya. Sila cuba lagi.", "error");
      return;
    }

    const payload = decodeJwtPayload(response.credential);
    if (!payload?.sub || !payload?.email) {
      setStatus("Maklumat akaun Google tidak dapat dibaca.", "error");
      return;
    }

    currentCredential = response.credential;
    currentUser = {
      id: payload.sub,
      name: payload.name || payload.given_name || "Google User",
      email: payload.email,
      picture: payload.picture || "",
      emailVerified: Boolean(payload.email_verified)
    };

    setStatus("Log masuk berjaya.", "success");
    window.dispatchEvent(new CustomEvent("rcash:google-login", {
      detail: currentUser
    }));

    if (window.RCashUI?.showApp) window.RCashUI.showApp();
  }

  function initializeGoogleSignIn() {
    hideEmailLogin();

    if (!window.google?.accounts?.id) {
      setStatus(
        "Google Sign-In tidak dapat dimuatkan. Sila muat semula halaman.",
        "error"
      );
      return;
    }

    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleCredential,
      ux_mode: "popup",
      context: "signin",
      auto_select: false
    });

    if (!googleBtn) {
      console.error("Butang #googleLoginBtn tidak dijumpai.");
      return;
    }

    const googleContainer = document.createElement("div");
    googleContainer.id = "googleOfficialButton";
    googleContainer.style.width = "100%";
    googleContainer.style.display = "flex";
    googleContainer.style.justifyContent = "center";
    googleContainer.style.alignItems = "center";
    googleBtn.replaceWith(googleContainer);

    requestAnimationFrame(() => {
      const containerWidth = googleContainer.getBoundingClientRect().width;
      const buttonWidth = Math.max(250, Math.min(400, Math.floor(containerWidth || 360)));

      google.accounts.id.renderButton(googleContainer, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "rectangular",
        logo_alignment: "left",
        width: buttonWidth
      });
    });

    setStatus("");
  }

  async function signOut() {
    currentUser = null;
    currentCredential = null;
    google.accounts?.id?.disableAutoSelect();
    setStatus("");
    window.dispatchEvent(new CustomEvent("rcash:logout"));
    if (window.RCashUI?.showAuth) window.RCashUI.showAuth();
  }

  window.RCashAuth = {
    signOut,
    getUser: () => currentUser,
    getCredential: () => currentCredential,
    isSignedIn: () => Boolean(currentUser && currentCredential)
  };

  window.addEventListener("load", initializeGoogleSignIn);
})();
