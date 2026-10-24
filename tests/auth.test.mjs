import test from 'node:test';
import assert from 'node:assert/strict';
import worker,{passwordRecord,checkPassword,signSession,session} from '../worker/index.js';
const env={ADMIN_USERNAME:'arwah',SITE_ORIGIN:'https://arwah.wtf',SESSION_SECRET:'test-only-session-secret-32-characters',GITHUB_TOKEN:'test-only',LOGIN_LIMITER:{limit:async()=>({success:true})},PASSWORD_RECORD:await passwordRecord('test-password-only')};
const request=(path,method='GET',data,headers={})=>new Request('https://arwah.wtf/admin-api/'+path,{method,headers:{Origin:'https://arwah.wtf','X-Admin-Request':'1','Content-Type':'application/json',...headers},...(data?{body:JSON.stringify(data)}:{})});
test('password hashing rejects wrong passwords',async()=>{assert(await checkPassword('test-password-only',env.PASSWORD_RECORD));assert(!await checkPassword('wrong',env.PASSWORD_RECORD));assert(!await checkPassword(undefined,env.PASSWORD_RECORD));});
test('sessions reject forgery, expiry, and missing cookies',async()=>{
 const signed=await signSession(env);const cookie='__Host-arwah_admin='+signed;
 assert(await session(request('session','GET',null,{Cookie:cookie}),env));
 assert(!await session(request('session','GET',null,{Cookie:cookie+'forged'}),env));
 const expired=await signSession(env,Date.now()-7200000);
 assert(!await session(request('session','GET',null,{Cookie:'__Host-arwah_admin='+expired}),env));
 assert(!await session(request('session'),env));
});
test('login sets secure cookie and logout clears it',async()=>{
 const response=await worker.fetch(request('login','POST',{username:'arwah',password:'test-password-only'}),env);
 assert.equal(response.status,200);const cookie=response.headers.get('Set-Cookie');
 for(const part of ['HttpOnly','Secure','SameSite=Strict','Max-Age=3600'])assert(cookie.includes(part));
 assert(!(await response.text()).includes(env.GITHUB_TOKEN));
 const logout=await worker.fetch(request('logout','POST',{}),env);assert(logout.headers.get('Set-Cookie').includes('Max-Age=0'));
});
test('reject unauthenticated writes, cross-origin requests, and brute-force attempts',async()=>{
 assert.equal((await worker.fetch(request('content','PUT',{}),env)).status,401);
 assert.equal((await worker.fetch(request('login','POST',{},{Origin:'https://evil.test'}),env)).status,403);
 assert.equal((await worker.fetch(request('login','POST',{}),{...env,LOGIN_LIMITER:{limit:async()=>({success:false})}})).status,429);
 assert.equal((await worker.fetch(request('login','POST',{username:'arwah',password:'wrong'}),env)).status,401);
 assert.equal((await worker.fetch(request('session'),{})).status,503);
});
test('authenticated writes preserve version checks and keep GitHub token server-side',async()=>{
 const fs=await import('node:fs');const data=JSON.parse(fs.readFileSync(new URL('../content/portfolio.json',import.meta.url)));
 const signed=await signSession(env);let upstream;
 const originalFetch=globalThis.fetch;
 try{
  globalThis.fetch=async(url,options)=>{upstream={url,options};return Response.json({content:{sha:'b'.repeat(40)},commit:{sha:'c'.repeat(40)},token:'should-not-be-returned'});};
  const response=await worker.fetch(request('content','PUT',{data,sha:'a'.repeat(40)},{Cookie:'__Host-arwah_admin='+signed}),env);
  assert.equal(response.status,200);assert.equal(upstream.options.headers.Authorization,'Bearer test-only');
  assert.equal(JSON.parse(upstream.options.body).sha,'a'.repeat(40));
  assert.equal(upstream.url,'https://api.github.com/repos/arwvah/arwvah.github.io/contents/content/portfolio.json');
  assert.deepEqual(await response.json(),{content:{sha:'b'.repeat(40)},commit:{sha:'c'.repeat(40)}});
 }finally{globalThis.fetch=originalFetch;}
});
