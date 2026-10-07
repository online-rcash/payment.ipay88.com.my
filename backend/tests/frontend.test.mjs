import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

test('six digits auto verify once; no success UI before session confirmation', async () => {
  const nodes = new Map();
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, { hidden: false, value: '', disabled: false, textContent: '', listeners: {}, classList: { toggle() {} }, setAttribute() {}, focus() {}, reportValidity() { return true; }, querySelector() { return { value: 'turnstile-test' }; }, addEventListener(name, fn) { this.listeners[name] = fn; } });
    return nodes.get(id);
  };
  const calls = [];
  let paymentOpened = 0, release;
  const window = { RCASH_AUTH_CONFIG: { apiBase: 'https://worker.test' }, goToPaymentPage() { paymentOpened++; }, turnstile: { reset() {} } };
  const context = { window, document: { getElementById: node }, sessionStorage: { getItem() { return ''; }, setItem() {}, removeItem() {} }, location: { hash: '', origin: 'https://www.rcash.my', pathname: '/', search: '' }, history: { replaceState() {} }, URLSearchParams, AbortController, Date, setInterval() {}, setTimeout, clearTimeout,
    fetch: async (url, init) => {
      calls.push({ url, init });
      if (url.endsWith('/api/send-otp')) return Response.json({ success: true, challengeId: 'challenge', resendAfter: 60 });
      if (url.endsWith('/api/verify-otp')) { await new Promise(resolve => { release = resolve; }); return Response.json({ success: true, sessionToken: 'a'.repeat(64) }); }
      return Response.json({ success: true, user: { email: 'user@example.com' } });
    }
  };
  vm.runInNewContext(readFileSync(new URL('../../auth/app-auth.js', import.meta.url), 'utf8'), context);
  node('emailInput').value = 'user@example.com';
  node('emailToggleButton').listeners.click();
  node('emailLoginForm').listeners.submit({ preventDefault() {} });
  await new Promise(setImmediate);
  node('otpCode').value = '12345'; await node('otpCode').listeners.input();
  assert.equal(calls.filter(x => x.url.endsWith('/api/verify-otp')).length, 0);
  node('otpCode').value = '123456'; const operation = node('otpCode').listeners.input();
  assert.equal(node('otpCode').disabled, true);
  await node('otpCode').listeners.input();
  assert.equal(calls.filter(x => x.url.endsWith('/api/verify-otp')).length, 1);
  assert.equal(paymentOpened, 0);
  release(); await operation;
  assert.equal(paymentOpened, 1);
  assert.equal(node('userDisplay').textContent, 'Welcome back, user');
  assert.equal(calls.find(x => x.url.endsWith('/api/session')).init.headers.Authorization, 'Bearer ' + 'a'.repeat(64));
});
