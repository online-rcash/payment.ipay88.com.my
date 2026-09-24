(() => {
  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

  const app = $("#app");
  const authScreen = $("#authScreen");
  const paymentModal = $("#paymentModal");
  const customerForm = $("#customerForm");
  const receiptFile = $("#receiptFile");

  const state = {
    customer: null,
    receipt: null
  };

  const translations = {
    ms: {
      loginTitle: "Log Masuk ke R-CASH",
      loginDesc: "Sila pilih kaedah log masuk pilihan anda untuk meneruskan.",
      googleLogin: "Continue with Google",
      orText: "atau",
      emailLogin: "Sign in with Email"
    },
    en: {
      loginTitle: "Sign in to R-CASH",
      loginDesc: "Choose your preferred sign-in method to continue.",
      googleLogin: "Continue with Google",
      orText: "or",
      emailLogin: "Sign in with Email"
    },
    zh: {
      loginTitle: "登录 R-CASH",
      loginDesc: "请选择您首选的登录方式继续。",
      googleLogin: "使用 Google 继续",
      orText: "或",
      emailLogin: "使用电子邮件登录"
    }
  };

  function showApp() {
    authScreen.classList.add("hidden");
    authScreen.setAttribute("aria-hidden", "true");
    app.classList.remove("hidden");
  }

  function showAuth() {
    app.classList.add("hidden");
    authScreen.classList.remove("hidden");
    authScreen.setAttribute("aria-hidden", "false");
  }

  window.RCashUI = { showApp, showAuth };

  $("#languageSelect")?.addEventListener("change", (e) => {
    const lang = translations[e.target.value] || translations.ms;
    $$("[data-i18n]").forEach((node) => {
      const key = node.dataset.i18n;
      if (lang[key]) node.textContent = lang[key];
    });
  });

  $("#toggleEmailBtn")?.addEventListener("click", () => {
    $("#emailAuthForm").classList.toggle("hidden");
  });

  function openPayment() {
    paymentModal.classList.remove("hidden");
    document.body.style.overflow = "hidden";
    goToStep(1);
  }

  function closePayment() {
    paymentModal.classList.add("hidden");
    document.body.style.overflow = "";
  }

  $("#openPaymentBtnTop")?.addEventListener("click", openPayment);
  $("#openPaymentBtnHero")?.addEventListener("click", openPayment);
  $$("[data-close-payment]").forEach((el) => el.addEventListener("click", closePayment));

  function goToStep(step) {
    for (let i = 1; i <= 3; i++) {
      $(`#paymentStep${i}`)?.classList.toggle("hidden", i !== step);
      $(`[data-progress="${i}"]`)?.classList.toggle("active", i <= step);
    }
  }

  $("#icNumber")?.addEventListener("input", (e) => {
    let value = e.target.value.replace(/\D/g, "").slice(0, 12);
    if (value.length > 6) value = value.slice(0, 6) + "-" + value.slice(6);
    if (value.length > 9) value = value.slice(0, 9) + "-" + value.slice(9);
    e.target.value = value;
  });

  $("#phoneNumber")?.addEventListener("input", (e) => {
    e.target.value = e.target.value.replace(/\D/g, "").replace(/^0+/, "").slice(0, 10);
  });

  $("#loanId")?.addEventListener("input", (e) => {
    e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "");
  });

  customerForm?.addEventListener("submit", (e) => {
    e.preventDefault();

    const amount = Number($("#paymentAmount").value);
    if (!Number.isFinite(amount) || amount <= 0) {
      alert("Sila masukkan jumlah pembayaran yang sah.");
      return;
    }

    state.customer = {
      fullName: $("#fullName").value.trim(),
      icNumber: $("#icNumber").value.trim(),
      loanId: $("#loanId").value.trim(),
      phoneNumber: "+60" + $("#phoneNumber").value.trim(),
      amount
    };

    const summary = [
      ["Full Name", state.customer.fullName],
      ["MyKad", state.customer.icNumber],
      ["Loan / CUST ID", state.customer.loanId],
      ["Phone", state.customer.phoneNumber],
      ["Amount", formatMYR(state.customer.amount)]
    ];

    $("#summaryBox").innerHTML = summary.map(([label, value]) => `
      <div class="summary-row">
        <span>${escapeHTML(label)}</span>
        <strong>${escapeHTML(value)}</strong>
      </div>
    `).join("");

    $("#qrAmount").textContent = formatMYR(state.customer.amount);
    goToStep(2);
  });

  $("#backToStep1")?.addEventListener("click", () => goToStep(1));

  receiptFile?.addEventListener("change", () => {
    state.receipt = receiptFile.files?.[0] || null;
    $("#receiptName").textContent = state.receipt ? state.receipt.name : "PNG, JPG or PDF";
  });

  $("#submitReceiptBtn")?.addEventListener("click", () => {
    if (!state.receipt) {
      alert("Sila muat naik resit pembayaran terlebih dahulu.");
      return;
    }

    const ref = `PAY-${Date.now().toString().slice(-8)}`;
    $("#successReference").innerHTML = `
      Reference: <strong>${escapeHTML(ref)}</strong><br>
      Amount: <strong>${escapeHTML(formatMYR(state.customer?.amount || 0))}</strong><br>
      Receipt: <strong>${escapeHTML(state.receipt.name)}</strong>
    `;

    goToStep(3);
  });

  $("#logoutBtn")?.addEventListener("click", async () => {
    if (window.RCashAuth?.signOut) {
      await window.RCashAuth.signOut();
    } else {
      localStorage.removeItem("rcash-demo-session");
      showAuth();
    }
  });

  function formatMYR(value) {
    return new Intl.NumberFormat("ms-MY", {
      style: "currency",
      currency: "MYR"
    }).format(value);
  }

  function escapeHTML(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // For a fresh template, keep the login screen visible.
  // Auth state is managed by auth.js.
})();
