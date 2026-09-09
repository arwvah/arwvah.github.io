# arwah.github.io

Personal portfolio of [arwah](https://github.com/arwah), published via GitHub Pages at **https://arwvah.github.io**

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
