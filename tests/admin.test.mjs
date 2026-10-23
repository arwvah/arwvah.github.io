import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {GitHub,encode,decode,validate,REPO,FILE} from '../admin/model.js';
const original=JSON.parse(fs.readFileSync(new URL('../content/portfolio.json',import.meta.url)));
test('Unicode writeups round-trip and current content validates',()=>{validate(original);assert.equal(decode(encode('CTF — café 🔐\nUzbekistan')), 'CTF — café 🔐\nUzbekistan');});
test('reject unsafe URLs, traversal, duplicates, and reserved paths',()=>{
 for(const mutate of [d=>d.projects[0].github='javascript:alert(1)',d=>d.projects[0].image='//evil.test/pixel',d=>d.writeups[0].source='../index.html',d=>d.writeups[0].slug='source',d=>d.writeups.push(d.writeups[0])]){const d=structuredClone(original);mutate(d);assert.throws(()=>validate(d));}
});
test('permission gate and publish use GitHub authorization and optimistic SHA',async()=>{
 const calls=[];globalThis.fetch=async(url,opts)=>{calls.push({url,opts});return {ok:true,json:async()=>opts.method==='PUT'?{content:{sha:'new'},commit:{sha:'commit'}}:url.endsWith(REPO)?{permissions:{push:true}}:{sha:'old',encoding:'base64',content:encode(JSON.stringify(original))}};};
 const api=new GitHub('test-only');const loaded=await api.load();await api.publish(loaded.data,loaded.sha);
 assert.equal(calls[2].url,`https://api.github.com/repos/${REPO}/contents/${FILE}`);
 assert.equal(calls[2].opts.headers.Authorization,'Bearer test-only');
 const body=JSON.parse(calls[2].opts.body);assert.equal(body.sha,'old');assert.equal(body.branch,'main');assert.deepEqual(JSON.parse(decode(body.content)),original);api.clear();
});
test('reject read-only access and keep conflicting publishes from overwriting content',async()=>{
 globalThis.fetch=async()=>({ok:true,json:async()=>({permissions:{push:false}})});
 await assert.rejects(new GitHub('test').load(),/write access/);
 globalThis.fetch=async()=>({ok:false,status:409});
 await assert.rejects(new GitHub('test').publish(original,'old'),/changed on GitHub/);
});
