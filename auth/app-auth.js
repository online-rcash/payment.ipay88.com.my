// One controller owns account choice, email OTP, magic links and Google sessions.
const $ = id => document.getElementById(id);
const config = window.RCASH_AUTH_CONFIG;
const storageKey = 'rcash_worker_session';
const t = (key, vars) => window.DJ_I18N.t('authFlow.' + key, vars);
let view = 'choice', method = 'otp', challenge = null, busy = false, epoch = 0;
let resendAt = 0, sent = false, workerUser = null, sessionToken = '';
let status = null, notice = null, widget = null, firebase = null, firebasePromise = null;
const digits = [...document.querySelectorAll('.otp-digit')];
let magicToken = new URLSearchParams(location.hash.slice(1)).get('rcash_magic');
if (magicToken) history.replaceState(null, '', location.pathname + location.search);
try { sessionToken = sessionStorage.getItem(storageKey) || ''; } catch {}
function saveToken(value) {
  sessionToken = value || '';
  try { value ? sessionStorage.setItem(storageKey, value) : sessionStorage.removeItem(storageKey); } catch {}
}
function visible(id, show) { const e = $(id); if (e) { e.hidden = !show; e.classList.toggle('hidden', !show); } }
function message(key, error = false, vars) {
  status = key ? {key, error, vars} : null;
  $('authMessage').textContent = key ? t(key, vars) : '';
  $('authMessage').className = 'login-message' + (error ? ' error' : '');
}
function showNotice(next) {
  notice = next;
  visible('accountNotice', !!next);
  if (next) {
    $('accountNoticeText').textContent = t(next === 'register' ? 'unregistered' : 'registered');
    $('accountNoticeAction').textContent = t(next);
  }
}
function renderUser() {
  visible('authLoginPanel', !workerUser);
  visible('authUserPanel', !!workerUser);
  $('btnPembayaranPinjaman')?.classList.toggle('hidden', !workerUser);
  const welcome = workerUser ? t('welcome', {name: workerUser.email.split('@')[0]}) : '';
  for (const id of ['userDisplay', 'authUserLabel']) if ($(id)) $(id).textContent = welcome;
}
function clearDigits() { digits.forEach(e => { e.value = ''; }); }
function tick() {
  const remaining = Math.max(0, Math.ceil((resendAt - Date.now()) / 1000));
  const magic = method === 'magic';
  $('resendOtpButton').disabled = busy || remaining > 0 || !sent;
  $('resendOtpButton').textContent = remaining ? t(magic ? 'linkResendIn' : 'resendIn', {seconds: remaining}) : t(magic ? 'resendLink' : 'resend');
  $('emailLoginButton').disabled = busy || (view !== 'forgot' && remaining > 0);
}
function lock(value) {
  busy = value;
  $('emailLoginForm').setAttribute('aria-busy', String(value));
  for (const id of ['chooseLoginButton','chooseRegisterButton','backChoiceButton','googleLoginButton','emailToggleButton','magicToggleButton','changeEmailButton','confirmMagicButton','accountNoticeAction']) $(id).disabled = value;
  $('emailInput').readOnly = value || !!challenge;
  for (const id of ['registerName','registerMykad','registerPhone']) $(id).readOnly = value || !!challenge;
  digits.forEach(e => { e.disabled = value; });
  tick();
}
function renderForm() {
  visible('accountChoice', view === 'choice' && !magicToken);
  visible('accountFormView', view !== 'choice' && !magicToken);
  visible('magicConfirmation', !!magicToken);
  $('formTitle').textContent = t(view === 'register' ? 'register' : view === 'forgot' ? 'forgot' : 'login');
  $('formSubtitle').textContent = t(view === 'register' ? 'registerDescription' : view === 'forgot' ? 'forgotDescription' : 'loginSubtitle');
  visible('registrationFields', view === 'register');
  $('registrationFields').disabled = view !== 'register';
  visible('loginProviders', view === 'login');
  visible('loginLinks', view === 'login');
  visible('backLoginLink', view === 'register' || view === 'forgot');
  visible('authTurnstile', view === 'login' || view === 'register');
  visible('otpSection', !!challenge && method === 'otp');
  visible('resendSection', sent && view !== 'forgot');
  visible('notReceived', method === 'otp');
  visible('changeEmailButton', sent);
  visible('emailLoginButton', !sent);
  $('emailInput').placeholder = t(view === 'register' ? 'newEmailPlaceholder' : 'emailPlaceholder');
  $('emailLoginButton').textContent = t(view === 'register' ? 'getOtp' : view === 'forgot' ? 'sendReset' : method === 'magic' ? 'sendLink' : 'continue');
  $('emailToggleButton').setAttribute('aria-pressed', String(method === 'otp'));
  $('magicToggleButton').setAttribute('aria-pressed', String(method === 'magic'));
  digits.forEach((e, i) => e.setAttribute('aria-label', t('digit', {n:i+1})));
  renderUser(); tick();
}
function switchView(next) {
  if (busy || magicToken) return;
  ++epoch; view = next; method = 'otp'; challenge = null; sent = false;
  clearDigits(); showNotice(null); message(null); lock(false); renderForm();
  if (next !== 'choice') { $('formTitle').focus(); renderTurnstile(); }
}
function selectMethod(next) {
  if (busy || magicToken) return;
  ++epoch; method = next; challenge = null; sent = false; clearDigits(); showNotice(null); message(null);
  lock(false); renderForm(); $('emailInput').focus(); renderTurnstile();
}
function renderTurnstile() {
  if (!['login','register'].includes(view) || magicToken || widget !== null) return;
  if (!window.turnstile?.render) return;
  try {
    widget = window.turnstile.render($('authTurnstile'), {
      sitekey: $('authTurnstile').dataset.sitekey, action:'auth', theme:'dark', size:'flexible',
      language: window.DJ_I18N.getLocale() === 'zh' ? 'zh-CN' : window.DJ_I18N.getLocale(),
      'error-callback': () => { message('securityFailed', true); return true; },
      'expired-callback': () => { message('security', true); }
    });
  } catch { message('securityFailed', true); }
}
function resetTurnstile() { if (widget !== null) try { window.turnstile?.reset(widget); } catch {} }
async function api(path, body) {
  if (!config?.apiBase) throw {code:'CONFIG_REQUIRED'};
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(config.apiBase + path, {
      method:body === undefined ? 'GET':'POST', credentials:'include', signal:controller.signal,
      headers:{...(body === undefined ? {} : {'Content-Type':'application/json'}), ...(sessionToken ? {Authorization:'Bearer ' + sessionToken}:{})},
      ...(body === undefined ? {} : {body:JSON.stringify(body)})
    });
    const data = await response.json();
    if (!response.ok || data.success !== true) throw {code:data.code, retryAfter:data.retryAfter};
    return data;
  } finally { clearTimeout(timer); }
}
function showError(error, fallback) {
  const code = error?.code;
  if (code === 'ACCOUNT_NOT_FOUND' || code === 'ACCOUNT_EXISTS') { message(null); showNotice(code === 'ACCOUNT_NOT_FOUND' ? 'register' : 'login'); return; }
  const keys = {OTP_INVALID:'invalid',OTP_EXPIRED:'expired',INVALID_PROFILE:'profileError',MAGIC_INVALID:'linkInvalid',CONFIG_REQUIRED:'serviceUnavailable',ORIGIN_REJECTED:'serviceUnavailable',GOOGLE_INVALID:'googleFailed',TURNSTILE_REJECTED:'security',TURNSTILE_CONFIG:'serviceUnavailable',TURNSTILE_INVALID:'security',TURNSTILE_FAILED:'security',TURNSTILE_REQUIRED:'security',SESSION_REQUIRED:'sessionFailed'};
  if (error?.retryAfter) {
    resendAt = Date.now() + error.retryAfter * 1000;
    message('cooldown',true,{seconds:error.retryAfter}); tick();
  } else message(keys[code] || fallback, true);
}
async function finish(data, operation) {
  if (operation !== epoch) return;
  if (data.sessionToken) saveToken(data.sessionToken);
  try {
    const confirmed = await api('/api/session');
    if (operation !== epoch) return;
    workerUser = confirmed.user; challenge = null; magicToken = null; sent = false;
    // Remove registration PII from the DOM after verification; never persist it in browser storage.
    ['registerName','registerMykad','registerPhone'].forEach(id => { $(id).value = ''; });
    clearDigits(); renderForm(); message('success'); openPayment();
  } catch { saveToken(null); throw {code:'SESSION_REQUIRED'}; }
}
async function send(isResend = false) {
  if (busy || (view !== 'forgot' && Date.now() < resendAt) || !$('emailLoginForm').reportValidity()) return;
  if (view === 'forgot') return resetPassword();
  const email = $('emailInput').value.trim().toLowerCase();
  let turnstileToken = '';
  try { if (widget !== null) turnstileToken = window.turnstile?.getResponse(widget) || ''; } catch {}
  if (!turnstileToken) { message('security',true); renderTurnstile(); return; }
  const operation = epoch; showNotice(null); lock(true); message(method === 'magic' ? 'linkSending' : 'sending');
  try {
    const data = await api(method === 'magic' ? '/api/send-magic-link' : '/api/send-otp', {
      email, intent:view, turnstileToken, redirectUrl:location.origin+location.pathname,
      ...(view === 'register' ? {fullName:$('registerName').value.trim(),mykad:$('registerMykad').value,phone:'+60'+$('registerPhone').value}: {})
    });
    if (operation !== epoch) return;
    if (data.flowVersion !== 2) throw {code:'CONFIG_REQUIRED'};
    resendAt = Date.now() + Math.max(60, data.resendAfter || 60) * 1000; sent = true;
    if (method === 'otp') { challenge = {email, challengeId:data.challengeId}; clearDigits(); }
    message(method === 'magic' ? 'linkSent' : isResend ? 'resent' : 'sent');
    renderForm();
  } catch (error) { if (operation === epoch) showError(error,method === 'magic' ? 'linkFailed':'failed'); }
  finally { resetTurnstile(); if (operation === epoch) { lock(false); if (challenge) digits[0].focus(); } }
}
async function verify() {
  const otp = digits.map(e => e.value).join('');
  if (busy || !challenge || !/^\d{6}$/.test(otp)) return;
  const operation = epoch; lock(true); message('verifying');
  try { await finish(await api('/api/verify-otp',{...challenge,otp}),operation); }
  catch (error) { if (operation === epoch) { showError(error,'verifyFailed'); clearDigits(); } }
  finally { if (operation === epoch) { lock(false); if (challenge) digits[0].focus(); } }
}
digits.forEach((input,index) => {
  input.addEventListener('input', () => {
    const value = input.value.replace(/\D/g,''); input.value = '';
    [...value.slice(0,6-index)].forEach((digit,offset) => { digits[index+offset].value = digit; });
    if (value) digits[Math.min(5,index+value.length)].focus();
    verify();
  });
  input.addEventListener('paste',event => {
    event.preventDefault(); const value = event.clipboardData.getData('text').replace(/\D/g,'').slice(0,6-index);
    [...value].forEach((digit,offset) => { digits[index+offset].value = digit; });
    digits[Math.min(5,index+value.length)].focus(); verify();
  });
  input.addEventListener('keydown',event => {
    if (event.key === 'Backspace' && !input.value && index > 0) { event.preventDefault(); digits[index-1].value=''; digits[index-1].focus(); }
    if (event.key === 'ArrowLeft' && index > 0) { event.preventDefault(); digits[index-1].focus(); }
    if (event.key === 'ArrowRight' && index < 5) { event.preventDefault(); digits[index+1].focus(); }
  });
  input.addEventListener('focus',() => input.select());
});
$('registerMykad').addEventListener('input',event => {
  const value = event.target.value.replace(/\D/g,'').slice(0,12);
  event.target.value = value.slice(0,6)+(value.length > 6 ? '-'+value.slice(6,8):'')+(value.length > 8 ? '-'+value.slice(8):'');
});
$('registerPhone').addEventListener('input',event => {
  let value=event.target.value.replace(/\D/g,'');
  if (value.startsWith('60')) value=value.slice(2);
  if (value.startsWith('0')) value=value.slice(1);
  event.target.value=value.slice(0,10);
});
function loadGoogle() {
  if (!firebasePromise) firebasePromise=import('../firebase-config.js').then(f => {firebase=f;return f;}).catch(error=>{firebasePromise=null;throw error;});
  return firebasePromise;
}
// Preload so the popup can open directly inside a user click (important on Safari).
loadGoogle().catch(()=>{});
$('googleLoginButton').addEventListener('click',async () => {
  if (busy) return;
  if (!firebase) { message('googleLoading'); loadGoogle().catch(()=>message('googleFailed',true)); return; }
  const operation=epoch; lock(true); showNotice(null); message(null);
  try {
    const result=await firebase.signInWithPopup(firebase.auth,firebase.googleProvider);
    if (operation !== epoch) return;
    const data=await api('/api/google-session',{idToken:await result.user.getIdToken()});
    await finish(data,operation);
  } catch(error) {
    if (operation === epoch) {
      if (error.code === 'ACCOUNT_NOT_FOUND') $('emailInput').value=firebase.auth.currentUser?.email || $('emailInput').value;
      const keys={'auth/unauthorized-domain':'googleDomain','auth/popup-blocked':'googlePopup','auth/popup-closed-by-user':'googleCancelled','auth/cancelled-popup-request':'googleCancelled'};
      keys[error.code] ? message(keys[error.code],true) : showError(error,'googleFailed');
    }
  } finally { if (operation === epoch) lock(false); }
});
async function resetPassword() {
  const operation=epoch; lock(true); message('resetSending');
  try {
    const f=await loadGoogle(); f.auth.languageCode=window.DJ_I18N.getLocale() === 'zh' ? 'zh-CN' : window.DJ_I18N.getLocale();
    await f.sendPasswordResetEmail(f.auth,$('emailInput').value.trim());
    if(operation===epoch) message('resetSent');
  } catch(error) { if(operation===epoch) message(error.code==='auth/user-not-found' ? 'resetSent':'resetFailed',error.code!=='auth/user-not-found'); }
  finally { if(operation===epoch) lock(false); }
}
$('confirmMagicButton').addEventListener('click',async()=>{
  if (!magicToken || busy) return;
  const operation=epoch;lock(true);message('verifying');
  try {await finish(await api('/api/verify-magic-link',{token:magicToken}),operation);}
  catch(error) {if(operation===epoch){magicToken=null;view='login';method='magic';renderForm();renderTurnstile();showError(error,'linkInvalid');}}
  finally {if(operation===epoch)lock(false);}
});
$('chooseLoginButton').addEventListener('click',()=>switchView('login'));
$('chooseRegisterButton').addEventListener('click',()=>switchView('register'));
$('backChoiceButton').addEventListener('click',()=>switchView('choice'));
for(const [id,next] of [['registerAccountLink','register'],['forgotPasswordLink','forgot'],['backLoginLink','login']]) $(id).addEventListener('click',event=>{event.preventDefault();switchView(next);});
$('accountNoticeAction').addEventListener('click',()=>switchView(notice));
$('emailToggleButton').addEventListener('click',()=>selectMethod('otp'));
$('magicToggleButton').addEventListener('click',()=>selectMethod('magic'));
$('emailLoginForm').addEventListener('submit',event=>{event.preventDefault();send();});
$('resendOtpButton').addEventListener('click',()=>send(true));
$('changeEmailButton').addEventListener('click',()=>{if(busy)return;challenge=null;sent=false;clearDigits();lock(false);renderForm();$('emailInput').focus();message(null);});
$('authContinueButton').addEventListener('click',()=>{if(workerUser)window.goToPaymentPage?.();});
window.logoutUser=async()=>{
  if(busy)return;++epoch;lock(true);
  try {
    await api('/api/logout',challenge||{});
    if(firebase?.auth.currentUser)await firebase.signOut(firebase.auth);
    saveToken(null);workerUser=null;challenge=null;sent=false;view='choice';magicToken=null;
    renderForm();window.backToMainFromPayment?.();message('loggedOut');
  } catch {message('logoutFailed',true);} finally{lock(false);}
};
$('logoutButton').addEventListener('click',window.logoutUser);
document.addEventListener('rcash:turnstile-ready',renderTurnstile);
document.addEventListener('duitjom:locale-changed',()=>{
  renderForm();if(status)message(status.key,status.error,status.vars);showNotice(notice);
  if(widget!==null){try{window.turnstile?.remove(widget);}catch{}widget=null;} renderTurnstile();
});
setInterval(tick,1000);renderForm();
if(!magicToken && ['#login','#register','#forgot-password'].includes(location.hash)) switchView(location.hash === '#register' ? 'register' : location.hash === '#forgot-password' ? 'forgot' : 'login');
// Cookie sessions also restore when sessionStorage is empty.
const restoreEpoch=epoch;
api('/api/session').then(data=>{if(epoch===restoreEpoch && !busy && !magicToken){workerUser=data.user;renderUser();}}).catch(error=>{if(epoch===restoreEpoch && !workerUser && error.code==='SESSION_REQUIRED')saveToken(null);});
// Preserve the payment form and transition; re-check a delayed Continue click.
function openPayment() {
  const show = () => {
    ['mainPage','firebaseAuthContainer','features-container'].forEach(id => $(id)?.classList.add('hidden'));
    $('paymentPage')?.classList.remove('hidden');
    window.scrollTo({top:0,behavior:'smooth'});
  };
  window.showPageTransition ? window.showPageTransition(show) : show();
}
window.goToPaymentPage = async function () {
  if (!workerUser || busy) return;
  const operation = epoch; lock(true);
  try {
    const confirmed = await api('/api/session');
    if (operation !== epoch) return;
    workerUser = confirmed.user; openPayment();
  } catch(error) {
    if(operation === epoch) {
      if(error.code === 'SESSION_REQUIRED') {workerUser=null;saveToken(null);renderUser();}
      showError(error,'sessionFailed');
    }
  } finally {if(operation===epoch)lock(false);}
};
