"""Interactive Cloudflare deployment. Secrets are never written into the repository."""
import argparse
import base64
import getpass
import hashlib
import json
import os
from pathlib import Path
import secrets
import subprocess
import tempfile

ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--bootstrap',type=Path,help='Private JSON containing PASSWORD_RECORD and SESSION_SECRET')
args=parser.parse_args()
if args.bootstrap:
    values=json.loads(args.bootstrap.read_text())
    values={k:values[k] for k in ('PASSWORD_RECORD','SESSION_SECRET')}
else:
    password=getpass.getpass('New admin password (hidden): ')
    if len(password)<12:raise SystemExit('Use at least 12 characters.')
    if password!=getpass.getpass('Repeat password: '):raise SystemExit('Passwords differ.')
    salt=secrets.token_bytes(16)
    digest=hashlib.pbkdf2_hmac('sha256',password.encode(),salt,100000)
    values={'PASSWORD_RECORD':'pbkdf2-sha256:100000:'+base64.b64encode(salt).decode()+':'+base64.b64encode(digest).decode(),'SESSION_SECRET':secrets.token_urlsafe(48)}
values['GITHUB_TOKEN']=getpass.getpass('GitHub fine-grained token, portfolio repository only (hidden): ').strip()
if not values['GITHUB_TOKEN']:raise SystemExit('A repository publishing token is required.')
cli=['npx','--yes','wrangler@4']
print('Authorize Cloudflare in your browser if asked. Only the admin API route will be deployed.')
# Explicit login lets the account owner review and grant Cloudflare access themselves.
subprocess.run(cli+['login','--scopes','account:read','user:read','workers:write','workers_routes:write','zone:read'],cwd=ROOT/'worker',check=True)
fd,path=tempfile.mkstemp(prefix='arwah-admin-secrets-',suffix='.json')
try:
    os.fchmod(fd,0o600)
    with os.fdopen(fd,'w') as stream:json.dump(values,stream)
    subprocess.run(cli+['deploy','--secrets-file',path],cwd=ROOT/'worker',check=True)
finally:
    Path(path).unlink(missing_ok=True)
print('Backend deployed. Ask the assistant to verify it and enable password mode in admin/auth-config.js.')
