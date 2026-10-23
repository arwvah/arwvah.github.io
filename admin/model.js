export const REPO = 'arwvah/arwvah.github.io';
export const FILE = 'content/portfolio.json';
export const encode = text => { const bytes = new TextEncoder().encode(text); let result=''; for (const byte of bytes) result += String.fromCharCode(byte); return btoa(result); };
export const decode = text => new TextDecoder().decode(Uint8Array.from(atob(text.replace(/\s/g, '')), c => c.charCodeAt(0)));
export function validate(data) {
  if (data.version !== 1) throw new Error('Unsupported content version.');
  for (const group of ['projects','experience','writeups']) {
    if (!Array.isArray(data[group]) || data[group].length > 500) throw new Error(`Invalid ${group} list.`);
    const fields = {projects:['id','name','description','github','image'],experience:['role','org','period','description'],writeups:['slug','title','category','summary','source','body']}[group];
    for (const item of data[group]) {
      for (const key of fields) if (typeof item[key] !== 'string' || !item[key].trim()) throw new Error(`${item.name || item.title || item.role || 'New entry'}: ${key} is required.`);
      if (group !== 'writeups' && (!Array.isArray(item.tags) || item.tags.some(t=>typeof t!=='string'))) throw new Error('Tags must be text.');
      if (group === 'projects') {
        if (!/^https:\/\/[^\s]+$/.test(item.github)) throw new Error('Project links must use HTTPS.');
        if (!/^https:\/\/[^\s]+$/.test(item.image) && !/^\/(?!\/)[^\s\\]+$/.test(item.image)) throw new Error('Images must use HTTPS or a local /images/ path.');
      }
      if (group === 'writeups') {
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.slug) || ['source','index','assets','admin'].includes(item.slug)) throw new Error('Use a unique lowercase writeup slug with hyphens.');
        if (!/^[^/\\\x00]+\.(md|txt)$/.test(item.source) || item.source.includes('..')) throw new Error('Invalid writeup filename.');
        if (typeof item.featured !== 'boolean') throw new Error('Invalid featured setting.');
      }
    }
  }
  for (const [group, key] of [['projects','id'],['writeups','slug'],['writeups','source']]) {
    const values = data[group].map(x=>x[key]);
    if (new Set(values).size !== values.length) throw new Error(`Duplicate ${key}; every entry needs a unique value.`);
  }
  if (new TextEncoder().encode(JSON.stringify(data,null,2)).length > 900000) throw new Error('Content exceeds the editor’s 900 KB limit. Split or shorten long writeups before publishing.');
}
export class GitHub {
  #token;
  constructor(token) { this.#token = token; }
  clear() { this.#token = ''; }
  async request(path, method='GET', body) {
    const response = await fetch(`https://api.github.com/repos/${REPO}${path}`, {
      method, cache:'no-store', redirect:'error', signal:AbortSignal.timeout(30000),
      headers:{Accept:'application/vnd.github+json',Authorization:`Bearer ${this.#token}`,'X-GitHub-Api-Version':'2022-11-28',...(body?{'Content-Type':'application/json'}:{})},
      ...(body?{body:JSON.stringify(body)}:{})
    });
    if (!response.ok) {
      const messages = {401:'The token is invalid or expired. Sign out and reconnect.',403:'GitHub denied access. Check repository Contents: Read and write permission, token expiration, and rate limits.',404:'Repository or content is unavailable. Check that the token includes arwvah.github.io.',409:'The content changed on GitHub. Download your draft, reload from GitHub, and reapply your edits.',422:'GitHub rejected the update. The file may have changed or branch rules may block direct publishing.'};
      throw new Error(messages[response.status] || `GitHub request failed (${response.status}). Try again shortly.`);
    }
    return response.json();
  }
  async load() {
    const repo = await this.request('');
    if (!repo.permissions?.push) throw new Error('This GitHub account does not have write access to the portfolio.');
    const file = await this.request(`/contents/${FILE}?ref=main`);
    if (file.encoding !== 'base64' || !file.content) throw new Error('Content could not be loaded. Check file size and format.');
    const data=JSON.parse(decode(file.content)); validate(data);
    return {data, sha:file.sha};
  }
  async publish(data, sha) {
    validate(data);
    // The SHA is an optimistic lock: concurrent content edits cannot be overwritten.
    return this.request(`/contents/${FILE}`, 'PUT', {message:'Update portfolio content from admin studio',branch:'main',sha,content:encode(JSON.stringify(data,null,2)+'\n')});
  }
}
