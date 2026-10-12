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
const env = { AUTH_DB: db, OTP_PEPPER: 'x'.repeat(32), MAIL_FROM_EMAIL: 'noreply@rcash.my', MJ_APIKEY_PUBLIC: 'test', MJ_APIKEY_PRIVATE: 'test', TURNSTILE_SECRET_KEY: 'test', FIREBASE_WEB_API_KEY: 'test-project-key' };
let emailContent, failMail = false;
globalThis.fetch = async (url, init) => {
  if (url.includes('identitytoolkit')) { const {idToken}=JSON.parse(init.body); return Response.json(idToken==='valid-google-token' ? {users:[{email:'signup@example.com',emailVerified:true,providerUserInfo:[{providerId:'google.com'}]}]} : {error:{message:'INVALID_ID_TOKEN'}}, {status:idToken==='valid-google-token'?200:400}); }
  if (url.includes('siteverify')) return Response.json({ success: true, hostname: 'www.rcash.my', action: 'auth' });
  emailContent = JSON.parse(init.body).Messages[0];
  return Response.json(failMail ? { Messages: [{ Status: 'error' }] } : { Messages: [{ Status: 'success', To: [{ MessageID: 123 }] }] });
};
async function call(path, body, token, requestOrigin = origin) {
  const response = await worker.fetch(new Request('https://worker.test' + path, { method: body === undefined ? 'GET' : 'POST', headers: { Origin: requestOrigin, 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }), env, { waitUntil() {} });
  return { response, data: await response.json() };
}

test('login cannot create an unregistered account', async () => {
 const result = await call('/api/send-otp', {email:'new@example.com',intent:'login',turnstileToken:'test'});
 assert.equal(result.data.code, 'ACCOUNT_NOT_FOUND');
 assert.equal(sql.prepare('SELECT count(*) AS n FROM email_auth_users').get().n, 0);
});
test('registration rejects an existing email before issuing a code', async () => {
 sql.prepare('INSERT INTO email_auth_users VALUES (?, ?)').run('member@example.com', 1);
 const result = await call('/api/send-otp', {email:'member@example.com',intent:'register',fullName:'Test Member',mykad:'000101-01-0001',phone:'+60123456789',turnstileToken:'test'});
 assert.equal(result.data.code, 'ACCOUNT_EXISTS');
});
test('registration stores details only after valid OTP; login preserves profile', async () => {
 let result = await call('/api/send-otp', {email:'signup@example.com',intent:'register',fullName:'Test Member',mykad:'000101-01-0001',phone:'+60123456789',turnstileToken:'test'});
 assert.equal(result.data.success, true);
 const challengeId=result.data.challengeId;
 const otp=emailContent.TextPart.match(/\b\d{6}\b/)[0];
 assert.equal(sql.prepare('SELECT email FROM email_auth_users WHERE email=?').get('signup@example.com'), undefined);
 result=await call('/api/verify-otp',{email:'signup@example.com',challengeId,otp});
 assert.equal(result.data.success,true);
 assert.equal(sql.prepare('SELECT full_name FROM email_auth_profiles WHERE email=?').get('signup@example.com').full_name,'Test Member');
 assert.equal((await call('/api/session',undefined,result.data.sessionToken)).data.user.email,'signup@example.com');
 assert.equal((await call('/api/verify-otp',{email:'signup@example.com',challengeId,otp})).data.code,'OTP_INVALID');
});

test('Google session rejects forged tokens and validates registered Google users through Firebase',async()=>{
 assert.equal((await call('/api/google-session',{idToken:'forged'})).data.code,'GOOGLE_INVALID');
 const result=await call('/api/google-session',{idToken:'valid-google-token'});
 assert.equal(result.data.success,true);
 assert.equal((await call('/api/session',undefined,result.data.sessionToken)).data.user.email,'signup@example.com');
});
test('a login challenge cannot be turned into a registration during verification',async()=>{
 sql.prepare('INSERT INTO email_auth_users VALUES (?,?)').run('legacy@example.com',1);
 let r=await call('/api/send-otp',{email:'legacy@example.com',intent:'login',turnstileToken:'test'});
 const otp=emailContent.TextPart.match(/\b\d{6}\b/)[0];
 r=await call('/api/verify-otp',{email:'legacy@example.com',challengeId:r.data.challengeId,otp,intent:'register',fullName:'Attacker'});
 assert.equal(r.data.success,true);
 assert.equal(sql.prepare('SELECT count(*) AS n FROM email_auth_profiles WHERE email=?').get('legacy@example.com').n,0);
});
test('resend cooldown, expired OTP and exhausted attempts are enforced by the server',async()=>{
 sql.prepare('INSERT INTO email_auth_users VALUES (?,?)').run('limits@example.com',1);
 let r=await call('/api/send-otp',{email:'limits@example.com',intent:'login',turnstileToken:'test'});
 const id=r.data.challengeId, otp=emailContent.TextPart.match(/\b\d{6}\b/)[0];
 assert.equal((await call('/api/send-otp',{email:'limits@example.com',intent:'login',turnstileToken:'test'})).data.code,'RESEND_COOLDOWN');
 sql.prepare('UPDATE email_otp_challenges SET expires_at=0 WHERE challenge_id=?').run(id);
 assert.equal((await call('/api/verify-otp',{email:'limits@example.com',challengeId:id,otp})).data.code,'OTP_EXPIRED');
 sql.prepare('UPDATE email_otp_challenges SET expires_at=?, attempts=5 WHERE challenge_id=?').run(Math.floor(Date.now()/1000)+300,id);
 assert.equal((await call('/api/verify-otp',{email:'limits@example.com',challengeId:id,otp})).data.code,'OTP_INVALID');
});
test('failed registration validation and unknown magic-link login never create accounts',async()=>{
 assert.equal((await call('/api/send-otp',{email:'bad-profile@example.com',intent:'register',fullName:'x',mykad:'123',phone:'0123',turnstileToken:'test'})).data.code,'INVALID_PROFILE');
 assert.equal((await call('/api/send-magic-link',{email:'never-registered@example.com',turnstileToken:'test'})).data.code,'ACCOUNT_NOT_FOUND');
 assert.equal(sql.prepare('SELECT count(*) AS n FROM email_auth_users WHERE email=?').get('never-registered@example.com').n,0);
});
