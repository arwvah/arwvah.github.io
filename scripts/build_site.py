"""Build the portfolio from content/portfolio.json; optionally into a clean output folder."""
import argparse
import hashlib
import html
import json
from pathlib import Path
import re
import runpy
import shutil

ROOT = Path(__file__).resolve().parents[1]

def validate(data):
    if data.get('version') != 1:
        raise ValueError('Unsupported content version')
    for group in ('projects', 'experience', 'writeups'):
        if not isinstance(data.get(group), list) or len(data[group]) > 500:
            raise ValueError(f'Invalid {group} list')
    def strings(item, fields):
        for field in fields:
            if not isinstance(item.get(field), str) or not item[field].strip():
                raise ValueError(f'Missing {field}')
    def url(value, image=False):
        if not (re.match(r'^https://[^\s]+$', value) or image and re.match(r'^/(?!/)[^\s\\]+$', value)):
            raise ValueError('Use HTTPS URLs or a local image path')
    for p in data['projects']:
        strings(p, ('id', 'name', 'description', 'github', 'image'))
        url(p['github']); url(p['image'], True)
    for e in data['experience']:
        strings(e, ('role', 'org', 'period', 'description'))
    for item in data['projects'] + data['experience']:
        if not isinstance(item.get('tags'), list) or not all(isinstance(t, str) for t in item['tags']):
            raise ValueError('Tags must be a list of strings')
    for w in data['writeups']:
        strings(w, ('slug', 'title', 'category', 'summary', 'source', 'body'))
        if not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', w['slug']) or w['slug'] in ('source', 'index', 'assets', 'admin'):
            raise ValueError('Invalid or reserved writeup slug')
        if not re.fullmatch(r'[^/\\\x00]+\.(md|txt)', w['source']) or '..' in w['source']:
            raise ValueError('Invalid source filename')
        if not isinstance(w.get('featured'), bool):
            raise ValueError('Featured must be true or false')
    for group, field in [('projects','id'), ('writeups','slug'), ('writeups','source')]:
        values = [x[field] for x in data[group]]
        if len(set(values)) != len(values):
            raise ValueError(f'Duplicate {field}')

def build(root):
    data = json.loads((root / 'content/portfolio.json').read_text())
    validate(data)
    runpy.run_path(str(root / 'scripts/build_writeups.py'))
    catalog = json.loads((root / 'writeups/catalog.json').read_text())
    featured_ids = {w['slug'] for w in data['writeups'] if w['featured']}
    featured = [w for w in catalog if w['slug'] in featured_ids]
    bundle_path = root / 'assets/routes-uNhI-opM.js'
    bundle = bundle_path.read_text()
    for name, value in [('AR_PROJECTS', data['projects']), ('AR_EXPERIENCE', data['experience']), ('WRITEUPS', featured)]:
        bundle, count = re.subn(r'var ' + name + r' = [\s\S]*?;\n', lambda _: 'var ' + name + ' = ' + json.dumps(value, ensure_ascii=True) + ';\n', bundle, count=1)
        if count != 1: raise ValueError(f'Cannot locate {name}')
    bundle = re.sub(r'Browse all \d+ writeups', f'Browse all {len(catalog)} writeups', bundle)
    bundle_path.write_text(bundle)
    esc = lambda v: html.escape(str(v), quote=True)
    tags = lambda ts, cls: '<ul class="' + cls + '">' + ''.join('<li>'+esc(t)+'</li>' for t in ts) + '</ul>'
    projects = ''.join(f'<article class="plate website-project"><div class="website-project-info"><h3>{esc(p["name"])}</h3><p class="website-project-description">{esc(p["description"])}</p>{tags(p["tags"], "website-project-tags")}<a class="btn-primary website-project-github" href="{esc(p["github"])}" target="_blank" rel="noopener noreferrer"><span class="btn-text">View on GitHub</span></a></div><div class="website-project-media"><img src="{esc(p["image"])}" alt="{esc(p["name"])} preview" loading="lazy"/></div></article>' for p in data['projects'])
    experience = ''.join(f'<article class="plate website-experience-item"><div class="website-experience-period">{esc(e["period"])}</div><div class="website-experience-body"><h3>{esc(e["role"])} · {esc(e["org"])}</h3><p>{esc(e["description"])}</p>{tags(e["tags"], "website-experience-tags")}</div></article>' for e in data['experience'])
    cards = ''.join(f'<a class="writeup-card" href="/writeups/{esc(w["slug"])}/"><span class="writeup-meta">{esc(w["category"])} · {w["minutes"]} min read</span><h3>{esc(w["title"])}</h3><p>{esc(w["summary"])}</p><span class="writeup-read">Read writeup ↗</span></a>' for w in featured)
    sections = {
        'projects': ('Projects', 'website-projects', 'website-projects', projects),
        'experience': ('Experience', 'website-experience', 'website-experience', '<div class="website-experience-timeline">'+experience+'</div>'),
        'writeups': ('Writeups', 'website-projects website-writeups', 'website-projects', '<p class="writeups-intro">CTF solutions, investigation notes, and lessons from each solve.</p><div class="writeup-grid">'+cards+f'</div><a class="btn-primary writeups-browse" href="/writeups/">Browse all {len(catalog)} writeups ↗</a>')}
    page = (root / 'index.html').read_text()
    for id, (title, cls, inner, body) in sections.items():
        section = f'<section aria-label="{title}" class="{cls}" id="{id}"><div class="website-content"><div class="{inner}-inner"><div class="{inner}-heading"><h2>{title}</h2></div>{body}</div></div></section>'
        page, n = re.subn(r'<section\b[^>]*\bid="'+id+r'"[^>]*>[\s\S]*?</section>', lambda _: section, page, count=1)
        if n != 1: raise ValueError(f'Cannot locate section {id}')
    (root / 'index.html').write_text(page)
    version = hashlib.sha256(json.dumps(data, sort_keys=True).encode()).hexdigest()[:12]
    for path in [root / 'index.html', * (root / 'assets').glob('*.js')]:
        text = path.read_text()
        text = re.sub(r'([.]js|[.]css)\?v=[\w-]+', lambda m: m[1]+'?v='+version, text)
        path.write_text(text)
    print(f'Built portfolio: {len(data["projects"])} projects, {len(data["experience"])} experiences, {len(catalog)} writeups')

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    root = ROOT
    if args.output:
        root = args.output.resolve()
        if root.exists(): raise SystemExit('Output folder must not already exist')
        shutil.copytree(ROOT, root, ignore=shutil.ignore_patterns('.git', '.venv*', 'node_modules', '__pycache__', 'tests'))
    build(root)
