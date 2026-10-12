import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read = path => readFileSync(new URL('../../'+path,import.meta.url),'utf8');
const settle = async()=>{for(let i=0;i<8;i++)await new Promise(setImmediate);};
function setup(options={}) {
 const nodes=new Map(), events={}, calls=[], intervals=[]; let locale='ms', timestamp=1000000, session=false, opened=0, release;
 for(const match of read('index.html').matchAll(/<\w+\b([^>]*\bid="([^"]+)"[^>]*)>/g)) {
  const attrs=match[1],classes=new Set((attrs.match(/class="([^"]*)"/)?.[1]||'').split(' '));
  const n={id:match[2],hidden:/\bhidden\b/.test(attrs),disabled:/\bdisabled\b/.test(attrs),value:'',textContent:'',dataset:{sitekey:'test'},listeners:{},style:{},
   classList:{toggle(k,on){on?classes.add(k):classes.delete(k);},add(k){classes.add(k)},remove(k){classes.delete(k)},contains(k){return classes.has(k)}},
   setAttribute(k,v){this[k]=v},getAttribute(k){return this[k]},focus(){doc.activeElement=this},select(){},reportValidity(){return true},
   addEventListener(k,fn){this.listeners[k]=fn}};nodes.set(n.id,n);
 }
 const node=id=>nodes.get(id),digits=[...nodes.values()].filter(n=>/^otpDigit/.test(n.id));
 const doc={activeElement:null,getElementById:node,querySelectorAll:q=>q==='.otp-digit'?digits:[],addEventListener:(k,f)=>{events[k]=f}};
 const window={RCASH_AUTH_CONFIG:{apiBase:'https://worker.test'},DUITJOM_I18N:null,scrollTo(){},showPageTransition(fn){opened++;fn()},turnstile:{render(){return 'widget'},reset(){},remove(){},getResponse(){return options.noTurnstile?'':'token'}}};
 const ctx={window,document:doc,location:{hash:'',origin:'https://www.rcash.my',pathname:'/',search:''},history:{replaceState(){}},sessionStorage:{getItem(){return ''},setItem(){},removeItem(){}},URLSearchParams,AbortController,Date:class extends Date{static now(){return timestamp}},setInterval(fn){intervals.push(fn)},setTimeout,clearTimeout,
  fetch:async(url,init)=>{
   calls.push({url,init});const body=init.body?JSON.parse(init.body):null;
   if(url.endsWith('/api/send-otp')||url.endsWith('/api/send-magic-link')){
    if(options.sendCode)return Response.json({success:false,code:options.sendCode},{status:400});
    return Response.json({success:true,flowVersion:2,challengeId:'challenge',resendAfter:60});
   }
   if(url.endsWith('/api/verify-otp')){
    if(options.holdVerify)await new Promise(resolve=>{release=resolve});
    if(options.verifyCode)return Response.json({success:false,code:options.verifyCode},{status:400});
    session=true;return Response.json({success:true,sessionToken:'a'.repeat(64)});
   }
   if(url.endsWith('/api/session'))return Response.json(session&&!options.sessionFailure?{success:true,user:{email:'user@example.com'}}:{success:false,code:'SESSION_REQUIRED'},{status:session&&!options.sessionFailure?200:401});
   if(url.endsWith('/api/logout')){session=false;return Response.json({success:true});}
   throw Error('unexpected route');
  }};
 vm.createContext(ctx);vm.runInContext(read('i18n/translations.js'),ctx);vm.runInContext(read('i18n/auth-flow.js'),ctx);
 window.DJ_I18N={getLocale:()=>locale,t:(key,vars)=>{let value=key.split('.').reduce((a,k)=>a?.[k],window.DUITJOM_I18N.locales[locale]);return value.replace(/\{(\w+)\}/g,(_,k)=>vars?.[k]??'');}};
 // SDK is a network boundary; no Firebase or Mailjet calls leave this test.
 const controller=read('auth/app-auth.js').replace("import('../firebase-config.js')","Promise.reject(new Error('SDK unavailable in this fixture'))");
 vm.runInContext(controller,ctx);
 const click=id=>node(id).listeners.click({preventDefault(){}});
 const send=()=>node('emailLoginForm').listeners.submit({preventDefault(){}});
 return {node,digits,click,send,calls,events,window,get opened(){return opened},release:()=>release(),advance(ms){timestamp+=ms;intervals.forEach(fn=>fn())},locale(next){locale=next;events['duitjom:locale-changed']()},async input(index,value){digits[index].value=value;digits[index].listeners.input();await settle()}};
}
test('account choice, register-only fields, notices and forgot password switch one form at a time',async()=>{
 const h=setup({sendCode:'ACCOUNT_NOT_FOUND'});await settle();
 assert.equal(h.node('accountChoice').hidden,false);assert.equal(h.node('accountFormView').hidden,true);
 h.click('chooseLoginButton');assert.equal(h.node('registrationFields').disabled,true);
 h.node('emailInput').value='new@example.com';h.send();await settle();assert.equal(h.node('accountNotice').hidden,false);
 h.click('accountNoticeAction');assert.equal(h.node('registrationFields').hidden,false);assert.equal(h.node('registrationFields').disabled,false);assert.equal(h.node('loginProviders').hidden,true);assert.equal(h.node('accountChoice').hidden,true);
 h.click('backLoginLink');h.click('forgotPasswordLink');assert.equal(h.node('formTitle').textContent,'Lupa Kata Laluan');assert.equal(h.node('authTurnstile').hidden,true);
});
test('six digits submit once and navigation waits for a confirmed server session',async()=>{
 const h=setup({holdVerify:true});await settle();h.click('chooseLoginButton');h.node('emailInput').value='user@example.com';h.send();await settle();
 assert.equal(h.node('resendOtpButton').disabled,true);assert.match(h.node('resendOtpButton').textContent,/60s/);
 await h.input(0,'12345');assert.equal(h.calls.filter(c=>c.url.endsWith('/api/verify-otp')).length,0);
 await h.input(5,'6');assert.equal(h.digits[0].disabled,true);assert.equal(h.opened,0);
 await h.input(5,'6');assert.equal(h.calls.filter(c=>c.url.endsWith('/api/verify-otp')).length,1);
 h.release();await settle();assert.equal(h.opened,1);assert.equal(h.node('authUserPanel').hidden,false);assert.equal(h.node('userDisplay').textContent,'Selamat kembali, user');
});
test('resend waits 60 seconds, clears old code, and language changes update status',async()=>{
 const h=setup();await settle();h.click('chooseRegisterButton');h.node('emailInput').value='user@example.com';h.node('registerName').value='Example User';h.node('registerMykad').value='000101-01-0001';h.node('registerPhone').value='123456789';h.send();await settle();
 const sent=JSON.parse(h.calls.find(c=>c.url.endsWith('/api/send-otp')).init.body);assert.equal(sent.intent,'register');assert.equal(sent.phone,'+60123456789');
 h.advance(59000);assert.equal(h.node('resendOtpButton').disabled,true);h.advance(1000);assert.equal(h.node('resendOtpButton').disabled,false);
 h.click('resendOtpButton');await settle();assert.match(h.node('authMessage').textContent,/OTP baharu/);assert.equal(h.node('resendOtpButton').disabled,true);
 h.locale('en');assert.match(h.node('authMessage').textContent,/A new OTP/);h.locale('zh');assert.match(h.node('authMessage').textContent,/新的验证码/);
});
test('invalid or expired OTP and session failure never open the payment form',async()=>{
 for(const config of [{verifyCode:'OTP_INVALID'},{verifyCode:'OTP_EXPIRED'},{sessionFailure:true}]){
  const h=setup(config);await settle();h.click('chooseLoginButton');h.node('emailInput').value='user@example.com';h.send();await settle();await h.input(0,'123456');assert.equal(h.opened,0);assert.equal(h.node('authUserPanel').hidden,true);assert.ok(h.node('authMessage').textContent);
 }
});
test('security verification is required before send; magic link uses its own endpoint',async()=>{
 const a=setup({noTurnstile:true});await settle();a.click('chooseLoginButton');a.node('emailInput').value='user@example.com';a.send();await settle();assert.equal(a.calls.filter(c=>c.url.endsWith('/api/send-otp')).length,0);
 const b=setup();await settle();b.click('chooseLoginButton');b.click('magicToggleButton');b.node('emailInput').value='user@example.com';b.send();await settle();assert.equal(b.calls.filter(c=>c.url.endsWith('/api/send-magic-link')).length,1);assert.equal(b.node('otpSection').hidden,true);assert.equal(b.node('resendSection').hidden,false);
});
