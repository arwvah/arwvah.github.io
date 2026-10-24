import {GitHub, REPO, validate} from './model.js';
import {SessionClient} from './session-client.js';
import {AUTH_MODE} from './auth-config.js';
const $ = id => document.getElementById(id);
const passwordMode=AUTH_MODE==='password';
$('token-fields').hidden=passwordMode;
$('token-help').hidden=passwordMode;
$('token').required=!passwordMode;
$('password-fields').hidden=!passwordMode;
$('password-note').hidden=!passwordMode;
$('username').required=passwordMode;
$('password').required=passwordMode;
$('login-submit').textContent=passwordMode?'Sign in →':'Connect to GitHub →';
const state = {client:null,data:null,sha:null,base:'',group:'projects',index:0,busy:false};
const markdown = window.markdownit({html:false,linkify:false,typographer:false});
// Previews never load images embedded in Markdown. Project images load only on request.
markdown.renderer.rules.image = (tokens, idx) => `<span>[Image: ${escape(tokens[idx].content)}]</span>`;
function escape(s) { return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
const dirty = () => state.data && JSON.stringify(state.data) !== state.base;
function status(message='',error=false) { $('status').textContent=message; $('status').classList.toggle('error',error); }
function busy(value) { state.busy=value; $('workspace').inert=value; $('login-form').inert=value; $('publish').disabled=value || !dirty(); }
function changed() { $('dirty-label').textContent=dirty()?'Unpublished changes':'All changes published'; $('publish').disabled=state.busy || !dirty(); }
function confirm(title,body,label='Continue') {
  $('confirm-title').textContent=title; $('confirm-body').textContent=body; $('confirm-yes').textContent=label;
  return new Promise(resolve=> { const d=$('confirm-dialog'); d.returnValue='cancel'; d.addEventListener('close',()=>resolve(d.returnValue==='yes'),{once:true}); d.showModal(); });
}
function title(item) { return item.name || item.role || item.title || 'Untitled entry'; }
const fields={
  projects:[['name','Project name'],['id','Unique ID'],['description','Description','textarea'],['github','GitHub / project URL'],['image','Screenshot URL or /images/ path'],['tags','Tags (comma separated)']],
  experience:[['role','Role / achievement'],['org','Organization'],['period','Date / period'],['description','Description','textarea'],['tags','Tags (comma separated)']],
  writeups:[['title','Title'],['slug','URL slug'],['category','Category'],['summary','Short summary','textarea'],['featured','Feature on the homepage','checkbox'],['body','Markdown body','markdown']]
};
function item() { return state.data?.[state.group][state.index]; }
function renderList() {
  for (const g of Object.keys(fields)) $('count-'+g).textContent=state.data[g].length;
  document.querySelectorAll('[data-group]').forEach(b=>{b.classList.toggle('active',b.dataset.group===state.group);b.setAttribute('aria-pressed',String(b.dataset.group===state.group));});
  $('list-title').textContent={projects:'Projects',experience:'Experience',writeups:'Writeups'}[state.group];
  const query=$('search').value.toLowerCase(); $('entries').replaceChildren();
  state.data[state.group].forEach((entry,i)=>{
    if (!title(entry).toLowerCase().includes(query)) return;
    const button=document.createElement('button'); button.type='button'; button.className='entry'+(i===state.index?' selected':''); button.setAttribute('aria-current',i===state.index?'true':'false');
    button.textContent=title(entry);
    const sub=document.createElement('small'); sub.textContent=entry.period || entry.category || entry.tags.join(' · '); button.append(sub);
    button.onclick=()=>{state.index=i; render();}; $('entries').append(button);
  });
  if (!$('entries').childElementCount) { const p=document.createElement('p'); p.textContent=query?'No matching entries.':'Nothing here yet. Add your first entry.'; $('entries').append(p); }
}
function renderEditor() {
  const entry=item(), form=$('editor-form'); form.replaceChildren();
  $('empty-editor').hidden=!!entry; form.hidden=!entry; $('preview-details').hidden=!entry;
  $('editing-title').textContent=entry?title(entry):'A fresh start';
  $('editing-kind').textContent=state.group.toUpperCase();
  for(const id of ['up','down','remove']) $(id).disabled=!entry;
  if (!entry) return;
  $('up').disabled=state.index===0; $('down').disabled=state.index===state.data[state.group].length-1;
  for (const [key,label,type='text'] of fields[state.group]) {
    const wrap=document.createElement('div');wrap.className='field'+(['textarea','markdown','checkbox'].includes(type)?' wide':'');
    const lab=document.createElement('label');lab.htmlFor='field-'+key;lab.textContent=label;
    const input=document.createElement(['textarea','markdown'].includes(type)?'textarea':'input');input.id='field-'+key;input.name=key;
    if(input.tagName==='INPUT') input.type=type==='checkbox'?'checkbox':'text';
    if(type==='checkbox') input.checked=entry[key]; else input.value=key==='tags'?entry.tags.join(', '):entry[key];
    if(type==='markdown') {input.className='markdown';input.spellcheck=false;}
    if(type!=='checkbox') input.required=key!=='tags';
    input.addEventListener('input',()=>{entry[key]=type==='checkbox'?input.checked:key==='tags'?input.value.split(',').map(t=>t.trim()).filter(Boolean):input.value;changed();renderList();$('editing-title').textContent=title(entry);if($('preview-details').open) preview();});
    wrap.append(lab,input);
    if(key==='slug') {const p=document.createElement('p');p.className='hint';p.textContent='Changing this changes the public URL. Existing links to the old URL will stop working.';wrap.append(p);}
    if(key==='image') {const p=document.createElement('p');p.className='hint';p.textContent='Use an existing repository image path or an HTTPS image URL.';wrap.append(p);}
    form.append(wrap);
  }
  preview();
}
function preview() {
  const entry=item();if(!entry)return;
  const box=$('preview');box.replaceChildren();
  const h=document.createElement('h2');h.textContent=title(entry);box.append(h);
  const p=document.createElement('p');p.textContent=entry.description || entry.summary;box.append(p);
  if(state.group==='writeups') {const article=document.createElement('article');article.innerHTML=markdown.render(entry.body.replace(/^# .+\n?/m,''));box.append(article);}
  else {
    if(entry.period){const period=document.createElement('p');period.textContent=entry.period+' · '+entry.org;box.prepend(period);}
    const tags=document.createElement('div');tags.className='tags';entry.tags.forEach(t=>{const x=document.createElement('span');x.textContent=t;tags.append(x);});box.append(tags);
    if(state.group==='projects' && $('preview-details').open && (/^https:\/\/[^\s]+$/.test(entry.image)||/^\/(?!\/)[^\s\\]+$/.test(entry.image))) {const img=document.createElement('img');img.src=entry.image;img.alt=entry.name+' preview';img.referrerPolicy='no-referrer';box.append(img);}
  }
}
function render() {renderList();renderEditor();changed();}
async function load() {
  const result=await state.client.load();state.data=result.data;state.sha=result.sha;state.base=JSON.stringify(result.data);state.index=0;
  $('login').hidden=true;$('workspace').hidden=false;$('account').textContent='Connected to '+REPO;render();
}
$('login-form').onsubmit=async e=>{
  e.preventDefault();busy(true);status('Signing in…');
  const token=$('token').value.trim();$('token').value='';
  const password=$('password').value;$('password').value='';
  state.client=passwordMode?new SessionClient():new GitHub(token);
  try {if(passwordMode)await state.client.login($('username').value.trim(),password);await load();status('Signed in. Pick an entry to start editing.');}
  catch(error) {if(!passwordMode)state.client?.clear();state.client=null;status(error.message,true);}
  finally {busy(false);}
};
$('editor-form').onsubmit=e=>e.preventDefault();
document.querySelectorAll('[data-group]').forEach(button=>button.onclick=()=>{state.group=button.dataset.group;state.index=0;$('search').value='';render();});
$('search').oninput=renderList;
$('preview-details').ontoggle=()=>{if($('preview-details').open)preview();};
$('add').onclick=()=>{
  const suffix=crypto.randomUUID().slice(0,8);
  const entry={projects:{id:'project-'+suffix,name:'New project',description:'',github:'https://github.com/arwvah/',image:'/images/project-flowguard.png',tags:[]},experience:{role:'New experience',org:'',period:'',description:'',tags:[]},writeups:{slug:'writeup-'+suffix,title:'New writeup',category:'Forensics',summary:'',featured:false,source:'writeup-'+suffix+'.md',body:'# New writeup\n\nStart your writeup here.\n'}}[state.group];
  state.data[state.group].push(entry);state.index=state.data[state.group].length-1;$('search').value='';render();$('editor-form').querySelector('input')?.focus();
};
for(const [id,delta] of [['up',-1],['down',1]]) $(id).onclick=()=>{const list=state.data[state.group],next=state.index+delta;if(next<0||next>=list.length)return;[list[state.index],list[next]]=[list[next],list[state.index]];state.index=next;render();};
$('remove').onclick=async()=>{if(!item())return;if(!await confirm('Remove this entry?',`“${title(item())}” will be removed when you publish. Previous versions remain in GitHub history.`,'Remove entry'))return;state.data[state.group].splice(state.index,1);state.index=Math.max(0,state.index-1);render();};
$('export').onclick=()=>{const blob=new Blob([JSON.stringify(state.data,null,2)+'\n'],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='portfolio-draft.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status('Draft downloaded. No access token is included.');};
$('reload').onclick=async()=>{if(dirty()&&!await confirm('Reload content?','This discards your unpublished edits. Download your draft first if you want to keep it.','Reload'))return;busy(true);try{await load();status('Latest content loaded.');}catch(e){status(e.message,true);}finally{busy(false);}};
$('logout').onclick=async()=>{if(dirty()&&!await confirm('Sign out?','Unpublished edits will be discarded. Download your draft first if needed.','Sign out'))return;try {await state.client?.clear();} catch(e) {status('Sign out failed. Try again; your server session has not been cleared.',true);return;}Object.assign(state,{client:null,data:null,sha:null,base:''});$('workspace').hidden=true;$('login').hidden=false;$('editor-form').replaceChildren();$('entries').replaceChildren();$('preview').replaceChildren();$('publish-result').hidden=true;status(passwordMode?'Signed out. Your session has ended.':'Signed out. Your token has been cleared.');};
$('publish').onclick=async()=>{
  try{validate(state.data);}catch(e){status(e.message,true);return;}
  if(!await confirm('Publish these changes?',`${state.data.projects.length} projects, ${state.data.experience.length} experience entries, and ${state.data.writeups.length} writeups will be saved to GitHub. The site updates after deployment succeeds.`,'Publish changes'))return;
  busy(true);status('Saving your changes to GitHub…');
  try{
    const result=await state.client.publish(state.data,state.sha);state.sha=result.content.sha;state.base=JSON.stringify(state.data);changed();
    const panel=$('publish-result');panel.replaceChildren();panel.hidden=false;
    const p=document.createElement('p');p.textContent='Saved to GitHub. Deployment is now queued; your live site updates after it succeeds.';panel.append(p);
    for(const [text,url] of [['View commit',`https://github.com/${REPO}/commit/${result.commit.sha}`],['Check deployment',`https://github.com/${REPO}/actions`],['Open portfolio','https://arwah.wtf/']]) {const a=document.createElement('a');a.textContent=text+' ↗';a.href=url;a.target='_blank';a.rel='noopener noreferrer';panel.append(a);}
    status('Content saved successfully. Check deployment for the live-site result.');
  }catch(e){status(e.message+' Your draft is still here; download it before reloading.',true);}
  finally{busy(false);}
};
window.addEventListener('beforeunload',event=>{if(dirty()||state.busy){event.preventDefault();event.returnValue='';}});

if(passwordMode){
  state.client=new SessionClient();busy(true);
  try{await state.client.request('session');await load();}catch{state.client=null;}finally{busy(false);}
}
