import {validate, encode, decode, REPO, FILE} from '../admin/model.js';
const encoder=new TextEncoder();
const COOKIE='__Host-arwah_admin';
const TTL=3600;
const bytes64=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes)));
const from64=value=>Uint8Array.from(atob(value),x=>x.charCodeAt(0));
const base64url=bytes=>bytes64(bytes).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
const unurl=value=>from64(value.replaceAll('-','+').replaceAll('_','/'));
const json=(body,status=200,headers={})=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',...headers}});
const cookie=(value,age=TTL)=>`${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`;
async function key(secret){return crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);}
export async function passwordRecord(password,salt=crypto.getRandomValues(new Uint8Array(16))){
 const material=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);
 const hash=await crypto.subtle.deriveBits({name:'PBKDF2',salt,iterations:100000,hash:'SHA-256'},material,256);
 return `pbkdf2-sha256:100000:${bytes64(salt)}:${bytes64(hash)}`;
}
export async function checkPassword(password,record){
 if(typeof password!=='string'||password.length>1024)return false;
 const parts=record.split(':');if(parts.length!==4||parts[0]!=='pbkdf2-sha256'||parts[1]!=='100000')return false;
 const candidate=await passwordRecord(password,from64(parts[2]));
 // Compare fixed-length digests without an early-exit string comparison.
 const a=from64(candidate.split(':')[3]),b=from64(parts[3]);let result=a.length^b.length;
 for(let i=0;i<a.length;i++)result|=a[i]^(b[i]||0);
 return result===0;
}
export async function signSession(env,now=Date.now()){
 const payload=base64url(encoder.encode(JSON.stringify({sub:env.ADMIN_USERNAME,exp:Math.floor(now/1000)+TTL,nonce:crypto.randomUUID()})));
 return payload+'.'+base64url(await crypto.subtle.sign('HMAC',await key(env.SESSION_SECRET),encoder.encode(payload)));
}
export async function session(request,env){
 try{
  const value=(request.headers.get('Cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
  if(!value||value.length>2048)return false;
  const [payload,signature,extra]=value.split('.');if(extra||!signature)return false;
  if(!await crypto.subtle.verify('HMAC',await key(env.SESSION_SECRET),unurl(signature),encoder.encode(payload)))return false;
  const data=JSON.parse(new TextDecoder().decode(unurl(payload)));
  return data.sub===env.ADMIN_USERNAME&&Number.isFinite(data.exp)&&data.exp>Math.floor(Date.now()/1000)&&data.exp<=Math.floor(Date.now()/1000)+TTL;
 }catch{return false;}
}
async function readJSON(request,limit){
 if(!request.headers.get('Content-Type')?.startsWith('application/json'))throw new Error('Use JSON');
 const reader=request.body?.getReader();if(!reader)throw new Error('Missing body');
 const chunks=[];let size=0;
 while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();throw new Error('Body too large');}chunks.push(value);}
 const all=new Uint8Array(size);let offset=0;for(const c of chunks){all.set(c,offset);offset+=c.length;}
 return JSON.parse(new TextDecoder().decode(all));
}
async function github(env,method='GET',body){
 const response=await fetch(`https://api.github.com/repos/${REPO}/contents/${FILE}${method==='GET'?'?ref=main':''}`,{method,redirect:'error',signal:AbortSignal.timeout(25000),headers:{'Authorization':`Bearer ${env.GITHUB_TOKEN}`,'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'arwah-portfolio-admin',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
 if(!response.ok){const conflict=[409,422].includes(response.status);return json({error:conflict?'Content changed or branch rules blocked publishing. Download your draft and reload before retrying.':'GitHub publishing is unavailable. Check the backend repository token.'},conflict?409:502);}
 const result=await response.json();
 if(method==='GET'){
  if(result.encoding!=='base64'||!result.content)return json({error:'Content is unavailable.'},502);
  const data=JSON.parse(decode(result.content));validate(data);return json({data,sha:result.sha});
 }
 return json({content:{sha:result.content.sha},commit:{sha:result.commit.sha}});
}
export default {async fetch(request,env){
 const path=new URL(request.url).pathname;
 if(!path.startsWith('/admin-api/'))return json({error:'Not found'},404);
 if(!env.PASSWORD_RECORD||!env.SESSION_SECRET||!env.GITHUB_TOKEN||!env.LOGIN_LIMITER)return json({error:'Password login is not configured yet.'},503);
 const mutation=!['GET','HEAD'].includes(request.method);
 if(mutation&&(request.headers.get('Origin')!==env.SITE_ORIGIN||request.headers.get('X-Admin-Request')!=='1'))return json({error:'Origin not allowed'},403);
 try{
  if(path==='/admin-api/login'&&request.method==='POST'){
   const {success}=await env.LOGIN_LIMITER.limit({key:request.headers.get('CF-Connecting-IP')||'unknown'});
   if(!success)return json({error:'Too many login attempts. Try again in a minute.'},429,{'Retry-After':'60'});
   const body=await readJSON(request,4096);
   const valid=await checkPassword(body.password,env.PASSWORD_RECORD);
   if(!valid||body.username!==env.ADMIN_USERNAME)return json({error:'Incorrect login or password.'},401);
   return json({ok:true},200,{'Set-Cookie':cookie(await signSession(env))});
  }
  if(path==='/admin-api/logout'&&request.method==='POST')return json({ok:true},200,{'Set-Cookie':cookie('',0)});
  if(!await session(request,env))return json({error:'Please sign in. Your session may have expired.'},401);
  if(path==='/admin-api/session'&&request.method==='GET')return json({ok:true});
  if(path==='/admin-api/content'&&request.method==='GET')return await github(env);
  if(path==='/admin-api/content'&&request.method==='PUT'){
   const {data,sha}=await readJSON(request,950000);validate(data);
   if(typeof sha!=='string'||!/^[a-f0-9]{40}$/.test(sha))return json({error:'Invalid content version.'},400);
   return await github(env,'PUT',{message:'Update portfolio from password-protected admin',branch:'main',sha,content:encode(JSON.stringify(data,null,2)+'\n')});
  }
  return json({error:'Not found'},404);
 }catch{return json({error:'The request could not be processed. Check your content and try again.'},400);}
}};
