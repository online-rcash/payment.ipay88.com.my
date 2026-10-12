/* =========================================================
   R-Cash CENTRALIZED I18N RUNTIME
   No build step. Include after i18n/translations.js.
   ========================================================= */
(function () {
  "use strict";

  var STORAGE_KEY = "duitjom_locale";
  var dict = window.DUITJOM_I18N || { defaultLocale: "en", locales: { en: {} } };

  var memoryLocale = null;
  function getLocale() {
    if (memoryLocale) return memoryLocale;
    try {
      var stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored && dict.locales[stored]) return stored;
    } catch (e) {}
    return dict.defaultLocale || "en";
  }

  function lookup(locale, key) {
    var parts = key.split(".");
    var node = dict.locales[locale];
    for (var i = 0; i < parts.length; i++) {
      if (node == null) return undefined;
      node = node[parts[i]];
    }
    return node;
  }

  function fallbackAuthFlowValue(key) {
    if (!key || !/^authFlow\./.test(key)) return undefined;

    var authKey = key.replace(/^authFlow\./, "");
    var englishFallbacks = {
      hub: "Payment Hub",
      account: "Your Account",
      chooseTitle: "Please select how you want to continue",
      chooseSubtitle: "Please choose one of the options below based on your account status.",
      login: "Log In",
      register: "Register Account",
      back: "Back to selection",
      google: "Continue with Google",
      emailMethod: "Log in with email",
      magicMethod: "Log in with link",
      email: "Email address",
      emailPlaceholder: "name@example.com",
      otpLabel: "Verification code",
      otpHint: "The code is verified automatically after the sixth digit is entered.",
      notReceived: "Didn't receive the code?",
      resend: "Resend code",
      changeEmail: "Change email address",
      noAccount: "Don't have an account?",
      registerLink: "Register",
      forgot: "Forgot password",
      backLogin: "Back to login",
      confirmHint: "Press the button below to confirm your login link.",
      success: "Verification successful.",
      continue: "Continue",
      welcome: "{name}, welcome back",
      loginSubtitle: "Please choose one of the following options to continue.",
      loginMessage: "Welcome back",
      verifyTitle: "Verify your email",
      verifySubtitle: "Check your inbox and enter the code we sent you.",
      resendIn: "Resend in {seconds}s",
      linkResendIn: "Send link in {seconds}s",
      sendLink: "Send link",
      getOtp: "Get code",
      sendReset: "Send reset link",
      forgotDescription: "We will help you recover your account.",
      registerDescription: "Create a new account in a few steps.",
      loginButton: "Continue",
      empty: "",
      paymentHub: "Payment Hub",
      authTitle: "Please select a method"
    };

    return englishFallbacks[authKey];
  }

  function interpolate(str, vars) {
    if (!vars) return str;
    return str.replace(/\{(\w+)\}/g, function (match, name) {
      return Object.prototype.hasOwnProperty.call(vars, name) ? vars[name] : match;
    });
  }

  function t(key, vars) {
    var locale = getLocale();
    var value = lookup(locale, key);
    if (value === undefined) value = lookup(dict.defaultLocale || "en", key);
    if (value === undefined) value = fallbackAuthFlowValue(key);
    if (value === undefined) value = lookup(locale, key.replace(/^authFlow\./, "auth."));
    if (value === undefined) value = lookup(dict.defaultLocale || "en", key.replace(/^authFlow\./, "auth."));
    if (value === undefined) return key;
    return interpolate(value, vars);
  }

  function setLocale(locale) {
    if (!dict.locales[locale]) return;
    memoryLocale = locale;
    try {
      window.localStorage.setItem(STORAGE_KEY, locale);
    } catch (e) {}
    document.documentElement.lang = locale;
    applyTranslations(document);
    document.dispatchEvent(new CustomEvent("duitjom:locale-changed", { detail: { locale: locale } }));
  }

  function applyTranslations(root) {
    root = root || document;
    document.documentElement.lang = getLocale();

    root.querySelectorAll("[data-i18n]").forEach(function (el) {
      el.textContent = t(el.getAttribute("data-i18n"));
    });
    root.querySelectorAll("[data-i18n-html]").forEach(function (el) {
      el.innerHTML = t(el.getAttribute("data-i18n-html"));
    });
    root.querySelectorAll("[data-i18n-placeholder]").forEach(function (el) {
      el.setAttribute("placeholder", t(el.getAttribute("data-i18n-placeholder")));
    });
    root.querySelectorAll("[data-i18n-aria-label]").forEach(function (el) {
      el.setAttribute("aria-label", t(el.getAttribute("data-i18n-aria-label")));
    });
    root.querySelectorAll("[data-i18n-title]").forEach(function (el) {
      el.setAttribute("title", t(el.getAttribute("data-i18n-title")));
    });

    var locale = getLocale();
    root.querySelectorAll("[data-locale-option]").forEach(function (el) {
      var isActive = el.getAttribute("data-locale-option") === locale;
      el.classList.toggle("lang-option-active", isActive);
      el.setAttribute("aria-current", isActive ? "true" : "false");
    });

    var localeFlags = { en: "🇺🇸", zh: "🇨🇳", ms: "🇲🇾" };
    var flagEl = root.querySelector(".lang-current-flag");
    var labelEl = root.querySelector(".lang-current-label");
    if (flagEl) flagEl.textContent = localeFlags[locale] || "🇺🇸";
    if (labelEl) labelEl.textContent = t("lang." + locale);
  }

  window.DJ_I18N = {
    t: t,
    getLocale: getLocale,
    setLocale: setLocale,
    applyTranslations: applyTranslations
  };

  document.addEventListener("DOMContentLoaded", function () {
    applyTranslations(document);
  });
})();
