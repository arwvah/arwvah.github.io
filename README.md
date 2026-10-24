# arwah.github.io

Personal portfolio of [arwah](https://github.com/arwah), published via GitHub Pages at **https://arwah.wtf**

## Stack

- Static site — content generated with Python before deployment
- React (pre-built bundles in `assets/`), GSAP animations, Three.js 3D hero wordmark
- Geist / Geist Mono variable fonts (self-hosted in `fonts/`)

## Development

Any static file server works. Python example:

```bash
python -m http.server 8000
```

Then open http://localhost:8000

## Deployment

Deployed from `main` with GitHub Actions. The workflow validates `content/portfolio.json`, renders the portfolio and writeup library, then deploys the generated artifact. GitHub Pages must use **GitHub Actions** as its source.

> Note: a `.nojekyll` file is included so GitHub Pages serves files as-is.

## Editing content

- **Intro text (About section):** the `Ir=` / `Lr=` strings near the top of `assets/routes-uNhI-opM.js`, plus the matching `aria-label` text and character spans in `index.html`
- **Terminal lines:** the `r=[[...]]` array inside `function TerminalPanel()` in `assets/routes-uNhI-opM.js` (format: `[kind, text]` where kind is `text`, `cmd`, or `out`) — and the mirrored HTML in `index.html`
- **Interest tags:** the `g=[[...]]` array in `TerminalPanel`
- **Projects, experience, and writeups:** use [the admin studio](https://arwah.wtf/admin/) or edit `content/portfolio.json`.

## Admin studio

Open **https://arwah.wtf/admin/**. Connect with a GitHub fine-grained personal access token restricted to **arwvah/arwvah.github.io**, with **Contents: Read and write**. Give it an expiration date. No server secret, shared password, or token is committed to this repository. The token is held in JavaScript memory only; sign out or reload to clear it. GitHub enforces authorization, so knowing the admin URL does not grant publishing access. The editor itself and all published content are public.

The studio supports adding, editing, removing and reordering projects, experience entries, and writeups; tags; screenshot URLs; Markdown previews; homepage featured writeups; draft downloads; and a publish confirmation. Project screenshots use existing `/images/` paths or HTTPS URLs. The editor does not upload image files.

**Publish changes** saves one atomic commit to `content/portfolio.json`. A file SHA check prevents overwriting concurrent content edits. Changes go live only after the deployment succeeds; use the deployment link shown after saving. Unsaved drafts remain in the tab, not browser storage. Download a draft before signing out or reloading if you need a backup. To restore a downloaded draft, replace `content/portfolio.json` in the repository with that JSON and commit it. Git history provides rollback for published content.

The token only needs Contents permission. If your branch rules prohibit direct commits, publishing will report an error; this version does not create pull requests. A repository admin can revoke a token in GitHub at any time.

## Content and writeup build

`content/portfolio.json` is the source of truth. Existing Markdown/text writeups were imported without changing the original external `/home/arwah/WriteUps` folder. `writeups/source/`, generated articles, the searchable library, homepage cards, and prebuilt React data are synchronized by the build. Editing generated bundles directly is not needed for these sections.

```bash
python -m venv .venv-writeups
.venv-writeups/bin/pip install -r scripts/requirements-writeups.txt
.venv-writeups/bin/python scripts/build_site.py --output /tmp/portfolio-preview
python -m http.server 8000 --directory /tmp/portfolio-preview
```

Use a fresh output directory for each build. Open `http://localhost:8000` or `/admin/`. Running `python scripts/build_site.py` without `--output` regenerates files in this checkout. The deployment build uses a clean artifact so removed writeups are no longer served. Changing a slug changes that article’s public URL; old URLs are not automatically redirected.

Markdown raw HTML is disabled in both build and preview. Admin scripts are self-hosted, with a restrictive CSP. GitHub tokens are sent only to `api.github.com`, never included in URLs or draft exports. The UI escapes editable text; input validation rejects unsafe project URLs and path traversal. Content is limited to 900 KB in the editor to stay within GitHub’s file-content API limit.

### Checks

```bash
node --test tests/admin.test.mjs
python -m unittest discover -s tests -p 'test_*.py'
```

Tests cover Unicode content, authorization failures, concurrent update conflicts, unsafe URLs, path traversal, synchronized rendering, deleted articles, Markdown escaping, and repeatable builds. The Markdown preview uses the self-hosted MIT-licensed markdown-it 14.1.0 distribution (`admin/markdown-it.LICENSE`).

## Password authentication backend

The matching metallic admin theme is served by GitHub Pages. Password authentication is implemented in `worker/index.js` and must be deployed separately to Cloudflare before changing `admin/auth-config.js` from `github` to `password`. Until then, the existing GitHub-token login remains functional.

The backend handles only `arwah.wtf/admin-api/*`. It uses a salted PBKDF2 password verifier, signed one-hour Secure/HttpOnly/SameSite cookies, same-origin checks, JSON-only mutation requests, and five login attempts per minute per IP per Cloudflare location. Repository writes are limited to `content/portfolio.json` and require the current file SHA. The GitHub token remains in a Cloudflare encrypted secret and is never returned to the browser. The username defaults to `arwah`; no password or verifier is committed to the repository. Logging out deletes the browser cookie; rotating `SESSION_SECRET` invalidates all sessions.

### One-time deployment

Create a fine-grained GitHub token scoped only to this repository with Contents read/write. Run `python scripts/setup_admin.py` and enter the password and token in its hidden prompts. The script opens Cloudflare authorization and deploys the Worker with encrypted secrets. It removes its temporary secret file afterward. `--bootstrap /private/path/bootstrap-secrets.json` can reuse a previously prepared password verifier and session key.

After deployment, verify the API rejects unauthenticated content requests, enable `AUTH_MODE = 'password'` in `admin/auth-config.js`, and deploy the site. Keep password mode disabled if backend provisioning has not succeeded. Tests: `node --test tests/auth.test.mjs tests/admin.test.mjs`.
