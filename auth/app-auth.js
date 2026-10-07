// Workers handles email authentication; Firebase is used only for Google.
const $ = id => document.getElementById(id);
const config = window.RCASH_AUTH_CONFIG;
const key = 'rcash_worker_session';
let sessionToken = '', workerUser = null, googleUser = null, firebase;
let method = 'otp', challenge = null, busy = false, epoch = 0, resendAt = 0;
let magicToken = new URLSearchParams(location.hash.slice(1)).get('rcash_magic');
if (magicToken) history.replaceState(null, '', location.pathname + location.search);
function visible(id, show) { $(id).hidden = !show; $(id).classList.toggle('hidden', !show); }
function message(text, error = false) { $('authMessage').textContent = text; $('authMessage').className = `login-message ${error ? 'error' : 'success'}`; }
function storage(value) { try { value === null ? sessionStorage.removeItem(key) : sessionStorage.setItem(key, value); } catch {} }
try { sessionToken = sessionStorage.getItem(key) || ''; } catch {}
async function api(path, body) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(config.apiBase + path, {
      method: body === undefined ? 'GET' : 'POST', credentials: 'include', signal: controller.signal,
      headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    let data;
    try { data = await response.json(); } catch { throw new Error('Backend tidak memberi respons JSON. Semak Workers dan tetapan domain.'); }
    if (!response.ok || data.success !== true) throw Object.assign(new Error(data.message || 'Permintaan gagal.'), { code: data.code, retryAfter: data.retryAfter });
    return data;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('Permintaan tamat masa. Sila cuba lagi.');
    throw error;
  } finally { clearTimeout(timeout); }
}
function renderUser() {
  const user = workerUser || googleUser;
  visible('authLoginPanel', !user); visible('authUserPanel', !!user);
  $('btnPembayaranPinjaman')?.classList.toggle('hidden', !user);
  const name = user?.email?.split('@')[0] || user?.displayName || '';
  $('userDisplay').textContent = user ? `Welcome back, ${name}` : '';
  if ($('authUserLabel')) $('authUserLabel').textContent = user ? `Welcome back, ${name}` : '';
}
function select(next) {
  if (busy || magicToken) return;
  method = next;
  visible('emailLoginForm', true); visible('otpSection', !!challenge && next === 'otp');
  $('emailToggleButton').setAttribute('aria-expanded', String(next === 'otp'));
  $('magicToggleButton').setAttribute('aria-expanded', String(next === 'magic'));
  $('emailMethodHint').textContent = next === 'otp' ? 'Terima kod OTP 6 digit melalui email.' : 'Terima pautan log masuk sekali guna melalui email. Tiada kata laluan.';
  $('emailLoginButton').textContent = next === 'otp' ? 'Hantar OTP' : 'Hantar Magic Link';
  $('emailInput').focus(); message('');
}
function resetTurnstile() { try { window.turnstile?.reset($('authTurnstile')); } catch {} }
function lock(value) {
  busy = value;
  for (const id of ['emailLoginButton','googleLoginButton','emailToggleButton','magicToggleButton','changeEmailButton','confirmMagicButton']) $(id).disabled = value;
  $('otpCode').disabled = value;
  tick();
}
function tick() {
  const remaining = Math.max(0, Math.ceil((resendAt - Date.now()) / 1000));
  $('resendOtpButton').disabled = busy || remaining > 0 || !challenge;
  $('resendOtpButton').textContent = remaining ? `Hantar semula OTP (${remaining}s)` : 'Hantar semula OTP';
  if (!busy) $('emailLoginButton').disabled = remaining > 0;
}
setInterval(tick, 1000);
async function finish(data, operation) {
  if (operation !== epoch) return;
  // Require a real session. The updated Worker returns a bearer token for cross-site browsers.
  if (data.sessionToken) { sessionToken = data.sessionToken; storage(sessionToken); }
  try {
    const confirmed = await api('/api/session');
    if (operation !== epoch) return;
    workerUser = confirmed.user; challenge = null; magicToken = null;
    visible('confirmMagicButton', false); renderUser(); message('Log masuk berjaya.');
    window.goToPaymentPage?.();
  } catch (error) {
    sessionToken = ''; storage(null);
    throw new Error('Pengesahan berjaya tetapi sesi tidak dapat dibuka. Deploy Workers baharu yang disediakan, kemudian cuba lagi.');
  }
}
async function send() {
  if (busy || Date.now() < resendAt || !$('emailInput').reportValidity()) return;
  const email = $('emailInput').value.trim().toLowerCase();
  const turnstileToken = $('authTurnstile').querySelector('[name="cf-turnstile-response"]')?.value;
  if (!turnstileToken) return message('Sila lengkapkan pengesahan keselamatan dahulu.', true);
  const operation = epoch; lock(true);
  try {
    const data = await api(method === 'otp' ? '/api/send-otp' : '/api/send-magic-link', { email, turnstileToken, redirectUrl: location.origin + location.pathname });
    if (operation !== epoch) return;
    resendAt = Date.now() + (data.resendAfter || 60) * 1000;
    if (method === 'otp') {
      challenge = { email, challengeId: data.challengeId }; visible('otpSection', true);
      $('emailInput').readOnly = true; $('otpCode').value = '';
      message('OTP dihantar. Semak peti masuk atau spam.');
    } else message('Magic Link dihantar. Buka email dan tekan pautan untuk log masuk.');
  } catch (error) {
    if (error.retryAfter) resendAt = Date.now() + error.retryAfter * 1000;
    if (operation === epoch) message(error.message, true);
  } finally { resetTurnstile(); lock(false); if (challenge) $('otpCode').focus(); }
}
$('emailToggleButton').addEventListener('click', () => select('otp'));
$('magicToggleButton').addEventListener('click', () => select('magic'));
$('emailLoginForm').addEventListener('submit', event => { event.preventDefault(); send(); });
$('resendOtpButton').addEventListener('click', send);
$('changeEmailButton').addEventListener('click', () => { challenge = null; $('emailInput').readOnly = false; visible('otpSection', false); select('otp'); });
$('otpCode').addEventListener('input', async () => {
  const code = $('otpCode').value.replace(/\D/g, '').slice(0, 6); $('otpCode').value = code;
  if (code.length !== 6 || !challenge || busy) return;
  const operation = epoch; lock(true); message('Sedang mengesahkan OTP…');
  try { await finish(await api('/api/verify-otp', { ...challenge, otp: code }), operation); }
  catch (error) { if (operation === epoch) { message(error.message, true); $('otpCode').value = ''; } }
  finally { lock(false); }
});
$('confirmMagicButton').addEventListener('click', async () => {
  if (!magicToken || busy) return;
  const operation = epoch; lock(true);
  try { await finish(await api('/api/verify-magic-link', { token: magicToken }), operation); }
  catch (error) { message(error.message, true); }
  finally { lock(false); }
});
async function loadGoogle() {
  if (!firebase) firebase = await import('../firebase-config.js');
  return firebase;
}
$('googleLoginButton').addEventListener('click', async () => {
  if (busy) return;
  const operation = epoch; lock(true);
  try {
    const f = await loadGoogle(); await f.authPersistenceReady;
    const result = await f.signInWithPopup(f.auth, f.googleProvider);
    if (operation === epoch) { googleUser = result.user; renderUser(); window.goToPaymentPage?.(); }
  } catch (error) { message(error.code === 'auth/unauthorized-domain' ? 'Domain website belum dibenarkan dalam Firebase untuk Google Login.' : 'Google Login tidak berjaya. Sila cuba lagi.', true); }
  finally { lock(false); }
});
window.logoutUser = async () => {
  if (busy) return;
  ++epoch; lock(true);
  try {
    if (workerUser || sessionToken) await api('/api/logout', challenge || {});
    if (googleUser) { const f = await loadGoogle(); await f.signOut(f.auth); }
    sessionToken = ''; storage(null); workerUser = null; googleUser = null; challenge = null;
    $('emailInput').readOnly = false; visible('otpSection', false); renderUser();
    window.backToMainFromPayment?.(); message('Anda telah log keluar.');
  } catch (error) { message('Log keluar belum berjaya. Sila cuba lagi.', true); }
  finally { lock(false); }
};
$('logoutButton').addEventListener('click', window.logoutUser);
renderUser();
if (magicToken) { visible('confirmMagicButton', true); message('Tekan butang untuk mengesahkan Magic Link anda.'); }
async function restore() {
  if (sessionToken) {
    try { workerUser = (await api('/api/session')).user; renderUser(); }
    catch (error) { if (error.code === 'SESSION_REQUIRED') { sessionToken = ''; storage(null); } }
  }
  try {
    const f = await loadGoogle();
    f.onAuthStateChanged(f.auth, user => { googleUser = user; renderUser(); });
  } catch { /* Email auth remains usable when Google cannot load. */ }
}
restore();
