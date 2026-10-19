"use client";

import { useEffect, useState } from "react";

const API_BASE = "https://mail.rcash.my";
const TURNSTILE_SITE_KEY = "0x4AAAAAAFDZ5bKGW2izQzbZ";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id: string) => void;
    };
  }
}

export default function Home() {
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [turnstileId, setTurnstileId] = useState<string | null>(null);

  // Periksa session sedia ada
  useEffect(() => {
    fetch(`${API_BASE}/api/session`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.email && setUser({ email: d.email }))
      .catch(() => {});
  }, []);

  // Load Turnstile script
  useEffect(() => {
    if (document.getElementById("turnstile-script")) return;
    const script = document.createElement("script");
    script.id = "turnstile-script";
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  }, []);

  // Render widget bila masuk step email
  useEffect(() => {
    if (step !== "email") return;
    const el = document.getElementById("turnstile-widget");
    if (!el || !window.turnstile) return;
    if (turnstileId) return;
    const id = window.turnstile.render(el, {
      sitekey: TURNSTILE_SITE_KEY,
      action: "auth",
      callback: (t: string) => setToken(t),
    });
    setTurnstileId(id as string);
  }, [step, turnstileId]);

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!token) { setError("Sahkan anda bukan robot (Turnstile)."); return; }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, turnstileToken: token }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Gagal hantar OTP."); }
      else { setInfo("OTP dihantar ke email anda."); setStep("otp"); }
    } catch {
      setError("Tidak dapat hubungi server.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!/^\d{6}$/.test(otp)) { setError("OTP mesti 6 digit."); return; }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, otp }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "OTP salah."); }
      else { setUser({ email }); setOtp(""); setStep("email"); setInfo(""); }
    } catch {
      setError("Tidak dapat hubungi server.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await fetch(`${API_BASE}/api/logout`, { method: "POST", credentials: "include" });
    setUser(null); setEmail(""); setStep("email"); setInfo("");
  }

  if (user) {
    return (
      <main>
        <h1>R-Cash</h1>
        <p>Anda telah log masuk: {user.email}</p>
        <button type="button" onClick={handleLogout}>Log Keluar</button>
      </main>
    );
  }

  return (
    <main>
      <h1>{step === "email" ? "Log Masuk / Daftar" : "Sahkan OTP"}</h1>
      {error && <p>{error}</p>}
      {info && <p>{info}</p>}

      {step === "email" ? (
        <form onSubmit={sendOtp}>
          <label>
            E-mel
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <div id="turnstile-widget" />
          <button type="submit" disabled={loading}>{loading ? "Memproses..." : "Hantar OTP"}</button>
        </form>
      ) : (
        <form onSubmit={verifyOtp}>
          <label>
            Kod OTP 6-digit
            <input
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              required
            />
          </label>
          <button type="submit" disabled={loading}>{loading ? "Memproses..." : "Sahkan"}</button>
          <button type="button" onClick={() => setStep("email")}>Tukar e-mel</button>
        </form>
      )}
    </main>
  );
}
