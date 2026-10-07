import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import worker from '../rcash-email-auth-worker.mjs';
const origin = 'https://www.rcash.my';
const sql = new DatabaseSync(':memory:');
sql.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
const db = {
  prepare(query) {
    let args = [];
    return { bind(...values) { args = values; return this; },
      async first() { return sql.prepare(query).get(...args) ?? null; },
      async run() { return { meta: { changes: Number(sql.prepare(query).run(...args).changes) } }; }
    };
  },
  async batch(statements) {
    sql.exec('BEGIN');
    try { const results = []; for (const statement of statements) results.push(await statement.run()); sql.exec('COMMIT'); return results; }
    catch (error) { sql.exec('ROLLBACK'); throw error; }
  }
};
const env = { AUTH_DB: db, OTP_PEPPER: 'x'.repeat(32), MAIL_FROM_EMAIL: 'noreply@rcash.my', MJ_APIKEY_PUBLIC: 'test', MJ_APIKEY_PRIVATE: 'test', TURNSTILE_SECRET_KEY: 'test' };
let emailContent, failMail = false;
globalThis.fetch = async (url, init) => {
  if (url.includes('siteverify')) return Response.json({ success: true, hostname: 'www.rcash.my', action: 'auth' });
  emailContent = JSON.parse(init.body).Messages[0];
  return Response.json(failMail ? { Messages: [{ Status: 'error' }] } : { Messages: [{ Status: 'success', To: [{ MessageID: 123 }] }] });
};
async function call(path, body, token, requestOrigin = origin) {
  const response = await worker.fetch(new Request('https://worker.test' + path, { method: body === undefined ? 'GET' : 'POST', headers: { Origin: requestOrigin, 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }), env, { waitUntil() {} });
  return { response, data: await response.json() };
}
test('OTP, magic links and session lifecycle', async () => {
  const rejected = await call('/api/send-otp', { email: 'alice@example.com', turnstileToken: 'test' }, null, 'https://evil.test');
  assert.equal(rejected.response.status, 403);
  assert.equal(rejected.response.headers.get('Access-Control-Allow-Origin'), null);
  let result = await call('/api/send-otp', { email: 'alice@example.com', turnstileToken: 'test' });
  assert.equal(result.data.success, true);
  const challengeId = result.data.challengeId;
  const otp = emailContent.TextPart.match(/\b\d{6}\b/)[0];
  result = await call('/api/verify-otp', { email: 'alice@example.com', challengeId, otp: otp === '000000' ? '111111' : '000000' });
  assert.equal(result.data.code, 'OTP_INVALID');
  result = await call('/api/verify-otp', { email: 'alice@example.com', challengeId, otp });
  assert.match(result.data.sessionToken, /^[a-f0-9]{64}$/);
  const session = result.data.sessionToken;
  assert.equal((await call('/api/session', undefined, session)).data.user.email, 'alice@example.com');
  assert.equal((await call('/api/verify-otp', { email: 'alice@example.com', challengeId, otp })).data.code, 'OTP_INVALID');
  await call('/api/logout', {}, session);
  assert.equal((await call('/api/session', undefined, session)).response.status, 401);
  assert.equal((await call('/api/send-magic-link', { email: 'magic@example.com', turnstileToken: 'test', redirectUrl: 'https://evil.test/' })).data.code, 'INVALID_REDIRECT');
  result = await call('/api/send-magic-link', { email: 'magic@example.com', turnstileToken: 'test', redirectUrl: origin + '/' });
  assert.equal(result.data.success, true);
  const token = emailContent.TextPart.match(/rcash_magic=([a-f0-9]{64})/)[1];
  const row = sql.prepare('SELECT * FROM email_magic_links WHERE email = ?').get('magic@example.com');
  assert.notEqual(row.token_hash, token);
  assert.equal((await call('/api/send-magic-link', { email: 'magic@example.com', turnstileToken: 'test' })).data.code, 'RESEND_COOLDOWN');
  const results = await Promise.all([call('/api/verify-magic-link', { token }), call('/api/verify-magic-link', { token })]);
  assert.equal(results.filter(r => r.data.success).length, 1);
  const magicSession = results.find(r => r.data.success).data.sessionToken;
  assert.equal((await call('/api/session', undefined, magicSession)).data.user.email, 'magic@example.com');
  await call('/api/logout', {}, magicSession);
  assert.equal((await call('/api/session', undefined, magicSession)).response.status, 401);
  await call('/api/send-magic-link', { email: 'expired@example.com', turnstileToken: 'test' });
  const expired = emailContent.TextPart.match(/rcash_magic=([a-f0-9]{64})/)[1];
  sql.prepare('UPDATE email_magic_links SET expires_at = 0 WHERE email = ?').run('expired@example.com');
  assert.equal((await call('/api/verify-magic-link', { token: expired })).data.code, 'MAGIC_INVALID');
  failMail = true;
  assert.equal((await call('/api/send-magic-link', { email: 'failed@example.com', turnstileToken: 'test' })).data.code, 'MAILJET_REJECTED');
  assert.equal(sql.prepare('SELECT delivery_status FROM email_magic_links WHERE email = ?').get('failed@example.com').delivery_status, 'failed');
});
