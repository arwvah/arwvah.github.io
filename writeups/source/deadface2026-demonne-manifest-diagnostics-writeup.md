# De Monne Financial — Hidden Activity — Writeup

**Category:** Mobile / Android
**Challenge:** "One of De Monne's developers suspects there is hidden activity occurring in the app, possibly due to manifest misconfigurations."
**Flag:** `deadface{flaG_ManIfesT3d}`
**Artifact:** `app-release.zip` → `app-release.apk` (`com.demonne.financial`, version 2.4.1 (5))

## Summary

The De Monne Financial banking app ships an internal `Diagnostics` activity that
is accidentally marked `android:exported="true"` in `AndroidManifest.xml`. Any app
or adb user on the device can launch it directly — no login required — and its
hardcoded diagnostic output contains the flag.

## Recon

The zip contains a single APK. Unpack it and decompile:

```bash
unzip app-release.zip          # -> app-release.apk
unzip app-release.apk -d apk   # -> classes.dex, classes2.dex, AndroidManifest.xml, ...
```

An initial `strings` sweep of the dex files already leaks the challenge's theme:

```
$ strings -n 6 apk/classes*.dex | grep -i deadface
diagnostic.code : deadface{flaG_ManIfesT3d}
Authorization Code: deadface{Ur_N0t_A110wEd_h3r3}
```

Two flag-shaped strings — one labeled `diagnostic.code`, one `Authorization Code`.
This challenge is the diagnostic one.

## Finding the misconfiguration

Parsing the binary manifest with androguard (`androguard.core.apk.APK` →
`get_android_manifest_axml()`) shows seven activities. Only two are exported,
and only one of them is suspicious:

```xml
<activity android:name="com.demonne.financial.SplashActivity" android:exported="true">
    ... launcher intent-filter ...
</activity>

<activity android:theme="@7F110224" android:label="Diagnostics"
          android:name="com.demonne.financial.internal.DiagnosticActivity"
          android:exported="true"/>          <!-- no intent-filter, yet exported -->
```

`com.demonne.financial.internal.DiagnosticActivity` lives in an `internal/`
package, has **no** `intent-filter` (so it was never meant to be launchable),
and is still `exported="true"` — the classic manifest misconfiguration. Every
other non-launcher activity is correctly `exported="false"`.

## Triggering it

`DiagnosticActivity.onCreate()` just `setContentView()`s and calls
`TextView.setText()` with a fully hardcoded diagnostic report
(`build.version`, `build.env : production`, `api.endpoint :
http://dmf.dctf.io:8081`, device info, and the flag between box-drawing
rules). No authentication, no session check.

Launch it directly on a device/emulator with the app installed:

```bash
adb shell am start -n com.demonne.financial/.internal.DiagnosticActivity
```

The Diagnostics screen renders:

```
build.version   : 2.4.1 (5)
build.env       : production
build.timestamp : 2026-01-14T09:00:00Z
api.endpoint    : http://dmf.dctf.io:8081
...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
diagnostic.code : deadface{flaG_ManIfesT3d}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

status          : internal build — not for distribution
```

## Flag

```
deadface{flaG_ManIfesT3d}
```

## Notes / other findings in the same APK

- `SecureVaultActivity` gates a "RESTRICTED" compliance document behind a
  `SecurityUtils.isDeviceRooted()` check (different challenge; its hardcoded
  `Authorization Code` is `deadface{Ur_N0t_A110wEd_h3r3}`).
- `ApiClient` hardcodes `INTERNAL_API_TOKEN`
  (`zqJRlVwBA9Xm2lE5EPjgbj/4rOxlkYZgDtkdP7jV80rZgLFrlnOEn+VAu31YKQrR`) that
  `InternalTokenInterceptor` attaches as `X-Internal-Token` to **every**
  request, and `LoginActivity` contains a hidden developer login
  (`audit@demonne-financial.local` / `demonnefinancial`) — relevant to the
  other De Monne challenges, not this one.
