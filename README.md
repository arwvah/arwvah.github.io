# arwah.github.io

Personal portfolio of [arwah](https://github.com/arwah), published via GitHub Pages at **https://arwah.wtf**

## Stack

- Static site — no build step required
- React (pre-built bundles in `assets/`), GSAP animations, Three.js 3D hero wordmark
- Geist / Geist Mono variable fonts (self-hosted in `fonts/`)

## Development

Any static file server works. Python example:

```bash
python -m http.server 8000
```

Then open http://localhost:8000

## Deployment

Deployed automatically by GitHub Pages from the root of this repository (`main` branch).

> Note: a `.nojekyll` file is included so GitHub Pages serves files as-is.

## Editing content

- **Intro text (About section):** the `Ir=` / `Lr=` strings near the top of `assets/routes-uNhI-opM.js`, plus the matching `aria-label` text and character spans in `index.html`
- **Terminal lines:** the `r=[[...]]` array inside `function TerminalPanel()` in `assets/routes-uNhI-opM.js` (format: `[kind, text]` where kind is `text`, `cmd`, or `out`) — and the mirrored HTML in `index.html`
- **Interest tags:** the `g=[[...]]` array in `TerminalPanel`
- **Projects section:** the `AR_PROJECTS` array in `assets/routes-uNhI-opM.js` (name, description, tags, GitHub link, screenshot path in `images/`)
- **Experience section:** the `AR_EXPERIENCE` array in `assets/routes-uNhI-opM.js` (period, role, org, description, tags)

## Writeup library

`writeups/source/` contains the 26 unique imported Markdown/text documents. The exact duplicate `stega_hidden.md` is represented by `geosint_writeup.md`; the two distinct penalty-shootout solutions remain separate. The original external folder is unchanged.

The generated static library at `/writeups/` includes search, category filters, responsive article pages, section navigation, and escaped code examples. Raw HTML inside Markdown is disabled. Source-relative Markdown links are rewritten to their article pages.

To regenerate after updating sources:

```bash
python -m venv .venv-writeups
.venv-writeups/bin/pip install -r scripts/requirements-writeups.txt
.venv-writeups/bin/python scripts/build_writeups.py
```

Commit the generated HTML and catalog alongside the sources. GitHub Pages serves these files without running Python. Homepage featured cards are mirrored in `index.html` and `assets/routes-uNhI-opM.js`; update both when changing the featured selection. Bump asset URL versions when changing the frontend to avoid stale browser caches.
