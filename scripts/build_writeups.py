"""Render the writeup library: python scripts/build_writeups.py (markdown-it-py)."""
from pathlib import Path
import html
import json
import math
import re
from markdown_it import MarkdownIt

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'writeups'
md = MarkdownIt('commonmark', {'html': False}).enable('table')

def slug(value):
    return re.sub(r'[^a-z0-9]+', '-', value.lower()).strip('-')

def plain(value):
    return re.sub(r'[`*_#]', '', value).strip()

def category(name, text):
    if 'geoint' in name or 'geosint' in name: return 'OSINT'
    if 'world' in name: return 'Scripting'
    if 'google' in name: return 'Cryptography'
    if 'heap' in name or 'skeleton' in name or 'the-crypt' in name: return 'Binary Exploitation'
    if 'spooky' in name or 'reptilian' in name: return 'Reverse Engineering'
    if 'manifest' in name or 'idor' in name: return 'Mobile / API'
    if 'veltrexa' in name or 'aurora' in name: return 'Web / Database'
    if 'grave' in name: return 'Web'
    if name == 'deadface-ctf-writeup.md': return 'Mixed Challenges'
    return 'Forensics'

from build_site import validate
data = json.loads((ROOT / 'content/portfolio.json').read_text())
validate(data)
# Clean only previously generated article directories and source documents.
previous = json.loads((OUT / 'catalog.json').read_text()) if (OUT / 'catalog.json').exists() else []
current_slugs = {d['slug'] for d in data['writeups']}
current_sources = {d['source'] for d in data['writeups']}
import shutil
for old in previous:
    if old['slug'] not in current_slugs and re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', old['slug']) and old['slug'] not in ('source', 'index', 'assets', 'admin'):
        directory = OUT / old['slug']
        if directory.is_dir(): shutil.rmtree(directory)
    if old['source'] not in current_sources and Path(old['source']).name == old['source']:
        (OUT / 'source' / old['source']).unlink(missing_ok=True)
docs = []
for entry in data['writeups']:
    text = entry['body']
    (OUT / 'source' / entry['source']).write_text(text)
    text = re.sub(r'\A---\n.*?\n---\n', '', text, count=1, flags=re.S).strip()
    if entry['source'].endswith('.txt'):
        text = '\n'.join(text.splitlines()[1:])
    # Title is controlled by the editor, independently of the Markdown body.
    text = re.sub(r'^# .+$', '', text, count=1, flags=re.M).strip()
    text = '# ' + entry['title'] + '\n\n' + text
    docs.append({k:v for k,v in entry.items() if k not in ('body', 'featured')} | {
        'text': text, 'minutes': max(1, math.ceil(len(text.split()) / 220))})
links = {d['source']: '/writeups/' + d['slug'] + '/' for d in docs}
if 'geosint_writeup.md' in links: links['stega_hidden.md'] = links['geosint_writeup.md']

def card(d):
    return f'''<a class="writeup-card" href="/writeups/{d['slug']}/" data-category="{html.escape(d['category'])}"><span class="writeup-meta">{html.escape(d['category'])} · {d['minutes']} min read</span><h3>{html.escape(d['title'])}</h3><p>{html.escape(d['summary'])}</p><span class="writeup-read">Read writeup ↗</span></a>'''

def page(title, body, description, extra=''):
    return f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{html.escape(title)} — arwah</title><meta name="description" content="{html.escape(description, quote=True)}"><link rel="icon" href="/favicon.svg"><link rel="stylesheet" href="/writeups/writeups.css?v=20261019-2"></head><body><header class="library-nav"><a href="/#writeups">← Portfolio</a><a href="/writeups/">Writeup library</a></header><main>{body}</main><footer>CTF solutions &amp; security notes · arwah</footer>{extra}</body></html>'''

for d in docs:
    tokens = md.parse(d['text'])
    toc = []
    used = {}
    for i, token in enumerate(tokens):
        if token.type == 'heading_open':
            label = plain(tokens[i+1].content)
            base = slug(label) or 'section'
            used[base] = used.get(base, 0) + 1
            ident = base if used[base] == 1 else f'{base}-{used[base]}'
            token.attrSet('id', ident)
            if token.tag == 'h2': toc.append(f'<li><a href="#{ident}">{html.escape(label)}</a></li>')
        for child in token.children or []:
            if child.type == 'link_open' and child.attrGet('href') in links:
                child.attrSet('href', links[child.attrGet('href')])
    article = md.renderer.render(tokens, md.options, {})
    body = f'<div class="article-meta">{html.escape(d["category"])} · {d["minutes"]} min read</div>'
    if toc: body += '<details class="contents"><summary>On this page</summary><ul>' + ''.join(toc) + '</ul></details>'
    body += '<article class="prose">' + article + '</article><a class="back-link" href="/writeups/">← All writeups</a>'
    directory = OUT / d['slug']; directory.mkdir(exist_ok=True)
    (directory / 'index.html').write_text(page(d['title'], body, d['summary']))

categories = sorted({d['category'] for d in docs})
options = '<option value="">All categories</option>' + ''.join(f'<option>{html.escape(c)}</option>' for c in categories)
body = f'''<div class="library-heading"><p class="eyebrow">CTF SOLUTIONS &amp; SECURITY NOTES</p><h1>Writeups</h1><p>Challenge walkthroughs, investigation notes, and lessons from each solve.</p></div><div class="library-controls"><label>Search writeups<input id="search" type="search" placeholder="Challenge, tool, or topic…"></label><label>Category<select id="category">{options}</select></label></div><p id="results" role="status">{len(docs)} writeups</p><div class="writeup-grid">{''.join(map(card, docs))}</div><p id="empty" hidden>No writeups match. Try another search or category.</p>'''
(OUT / 'index.html').write_text(page('Writeups', body, 'CTF writeups and cybersecurity investigations.', '<script src="/writeups/search.js?v=20261019-2" defer></script>'))
public = [{k:v for k,v in d.items() if k != 'text'} for d in docs]
(OUT / 'catalog.json').write_text(json.dumps(public, ensure_ascii=False, indent=2)+'\n')
print(f'Rendered {len(docs)} writeups.')
