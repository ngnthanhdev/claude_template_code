---
name: expo-security
description: Use when hardening apps/mobile against OWASP MASVS — token storage, EXPO_PUBLIC_ env vars, Expo Router/deep-link validation, networking/TLS, persisted Zustand/MMKV/AsyncStorage state, WebView usage, and app.json/eas.json/AndroidManifest build configuration. Pairs with backend-auth-security (the server side re-checking every authz decision this skill says the client can't be trusted for) and security-review for auditing a mobile diff.
---

# expo-security

Mobile hardening for `apps/mobile` against **OWASP MASVS** (Mobile
Application Security Verification Standard), informed by **MASWE** (the
weakness enumeration behind MASVS controls) and **MASTG** (the testing guide
with concrete verification steps). Generic web-security tooling (Semgrep,
ZAP) misses most of what's below — it's mobile-specific by nature.

## Trust model

The mobile app is an **untrusted client** — the same posture
`security-threat-model` establishes for the mobile↔API boundary. Concretely:

- Never rely on a hidden screen, a disabled button, or a client-side role
  check (`if (user.role === "admin")` gating a UI element) as a security
  control. A jailbroken/rooted device, a repackaged APK, or a plain HTTP
  proxy replaying a modified request bypasses all three trivially.
- **Every authorization decision the mobile app appears to make must be
  independently re-checked by the NestJS API** (`backend-auth-security`'s
  `RolesGuard` + scoped Prisma queries). The mobile-side check is UX
  (don't show a button the user can't use) — it is never the enforcement.

## Token storage

Tokens, OTP codes, passwords, and cryptographic keys are secrets. Never
persist them in:

- `AsyncStorage` — unencrypted, plaintext on disk.
- A Zustand store with `persist` middleware backed by `AsyncStorage`/default
  storage — same problem, one layer removed.
- Unencrypted MMKV — MMKV is fast but not encrypted by default; it needs an
  explicit encryption key to be an acceptable secret store, and even then,
  prefer the platform keychain for anything token-shaped.
- `redux-persist` (or any persistence middleware) writing to unencrypted
  storage.

Prefer `expo-secure-store` (iOS Keychain / Android Keystore-backed) — see
`mobile-auth-state`'s implementation for the exact pattern this template
uses. For native-module-level control beyond what `expo-secure-store`
exposes, use the platform Keychain/Keystore API directly via a config plugin.

Review, on every auth-related change: does **logout** actually clear the
stored tokens (`SecureStore.deleteItemAsync`, not just clearing in-memory
state), and does the API **revoke** the refresh token server-side so a
captured-but-not-yet-expired token can't still be replayed after the user
logged out?

## `EXPO_PUBLIC_*` environment variables

Every variable prefixed `EXPO_PUBLIC_` is compiled into the JS bundle and is
**publicly extractable** from the shipped app — unzip an APK/IPA and it's
readable as plain text, no reverse-engineering skill required. Never put
behind this prefix:

- A server secret, private key, or service-account credential.
- A database connection string or admin API key.
- Anything that, if read by every install of the app, would be a breach.

`EXPO_PUBLIC_*` is for genuinely public configuration only (an API base
URL, a public analytics write-key scoped to be safe if leaked, a feature
flag). If a value must stay secret, it belongs server-side behind an
authenticated API call, not in the client bundle at all.

## Navigation and deep links

- Validate every Expo Router param and every deep-link input as untrusted
  data — the same DTO-validation discipline `nestjs-zod` applies server-side
  applies here: don't trust a route param's shape or range without checking it.
- **Allowlist** schemes, hosts, and paths for any link the app opens
  (`Linking.openURL`, an in-app browser, a WebView `src`) — don't hand an
  attacker-controlled URL straight to the OS or a WebView.
- **No sensitive action fires directly from an unverified deep link.** A
  deep link can arrive from anywhere (a message, a QR code, another app) —
  treat it like a GET request from an anonymous source. If a deep link would
  trigger a state-changing action (accept an invite, confirm a payment, log
  in as another account), require an explicit in-app confirmation step
  first, never execute on parse.

## Networking

- Never disable TLS certificate validation and never install a permissive
  `TrustManager`/accept-all-certificates configuration, even temporarily for
  local debugging in a branch that could ship — this is the single most
  common way a mobile app becomes trivially MITM-able.
- Never log the `Authorization` header or a sensitive request/response body
  (tokens, passwords, PII) — a debug `console.log` of an Axios/fetch config
  object is the easiest way to leak a token into a crash-reporting service
  or a device log an attacker can pull.

## Persistence

Every field persisted via Zustand `persist`, MMKV, or `AsyncStorage` should
be reviewed individually:

- Persist the **minimum** needed to restore UX state across restarts — not
  "the whole store" by default.
- Sensitive state (auth tokens excluded per above, but also things like a
  cached PII payload, a payment method summary) should either not persist at
  all or persist only in an encrypted store.
- **Clear sensitive state on logout and on account switch** — a persisted
  store that isn't reset lets User B, signing in on a shared/reused device,
  see User A's cached data before the first authenticated fetch overwrites it.

## WebView

- Avoid a WebView for any sensitive flow (login, payment entry) where a
  native screen is possible — a WebView widens the attack surface (arbitrary
  page content, JS execution context) for no functional gain in those cases.
- When a WebView is unavoidable, restrict allowed origins and navigation
  (`onShouldStartLoadWithRequest`/`originWhitelist`), avoid exposing an
  unsafe native bridge (`injectedJavaScript` that grants broad native
  capability to arbitrary page content), and explicitly block `file://` and
  any unexpected custom scheme from loading inside it.

## Build configuration

Review on every change that touches app identity, permissions, or native
config:

- `app.json`/`app.config.ts` — permissions requested (`ios.infoPlist`,
  `android.permissions`) are the minimum the feature needs; unused
  permissions inherited from a template or a copy-pasted config plugin get
  removed, not left "just in case".
- `eas.json` — build profiles (`development`/`preview`/`production`) don't
  leak dev-only behavior (verbose logging, a debug menu, a staging API URL)
  into the `production` profile.
- `AndroidManifest.xml` (via config plugins, since this template doesn't
  hand-edit native projects) — exported components (see below).
- URL schemes and associated domains — see below.
- Debug behavior (a hidden dev menu, `__DEV__`-gated screens, verbose error
  overlays) must be genuinely unreachable in a production build, not just
  hidden behind a flag that's still evaluable by a determined user.

## Mobile-specific checks generic tools miss

- **Android exported components.** Any `<activity>`, `<service>`,
  `<receiver>`, or `<provider>` with `android:exported="true"` (required
  explicitly on API 31+) is reachable by any app on the device unless
  protected by a permission or signature check — audit every exported
  component a config plugin adds; don't export anything that doesn't need
  to be launchable externally.
- **iOS URL schemes & Associated Domains.** A custom URL scheme
  (`myapp://`) can be registered by any app, including a malicious one, on
  devices without Associated Domains — prefer Universal Links (Associated
  Domains, `apple-app-site-association`) for anything security-sensitive
  (auth callbacks, invite acceptance) over a bare custom scheme.
- **EAS secrets & build profiles.** Secrets injected via `eas secret:create`
  are only as safe as the build profile they're scoped to — verify a
  production-only secret isn't also readable from a `preview`/`development`
  profile that a wider set of people can trigger builds from.
- **Production source maps.** Don't ship a readable/unminified JS bundle or
  leave source maps publicly fetchable in a production build/OTA update —
  they make reverse-engineering business logic and finding other bugs
  trivial. Keep source maps for crash-reporting upload only, not bundled
  with the client artifact.
- **Jailbreak/root considerations.** Decide deliberately, per feature,
  whether a jailbroken/rooted device should be allowed to use
  security-sensitive functionality (payments, high-value transactions) —
  and remember any client-side jailbreak/root check is itself bypassable, so
  it's a risk-reduction signal, not an access-control mechanism; the
  authoritative check stays server-side.
- **Android backup.** `android:allowBackup` (and Auto Backup /
  `android:fullBackupContent`) can let a device backup exfiltrate app data,
  including anything left in unencrypted storage — set `allowBackup="false"`
  or scope `fullBackupContent` to exclude sensitive files if backup is needed
  for non-sensitive data.
- **iOS app-switcher snapshot.** iOS snapshots the current screen for the
  app switcher — a sensitive screen (payment form, OTP entry, a visible
  token) left on-screen when backgrounded gets captured in that snapshot;
  blur or replace the screen content on `AppState` background transition for
  any screen showing sensitive data.
- **Native modules & config plugins.** A third-party native module or a
  config plugin that patches native project files runs with full native
  capability, unaudited by JS-level tooling — review what a new native
  dependency actually does (network calls, permissions it silently adds)
  before adopting it, the same scrutiny a new backend dependency gets.
- **Scanning the built APK/IPA.** Static/dynamic analysis of the shipped
  binary (MobSF) catches things no source-level review can — hardcoded
  secrets that snuck into a native config, exported component exposure,
  weak crypto usage in a bundled native library. This is a release-time
  step (`docs/SECURITY.md`'s workflow), not something the template's CI runs
  on every PR, since it needs a built artifact.

## Report format

Same discipline as `security-review`, MASVS in place of ASVS:

- **Severity** — Critical / High / Medium / Low.
- **File and line.**
- **Exploitation scenario.**
- **Impact.**
- **Remediation** — the concrete code/config change.
- **Regression test** — a Jest/RTL test, a Maestro flow, or (for
  build-config findings) the manual verification step (e.g. "inspect the
  built APK's manifest for `exported=true`").
- **MASVS category** — e.g. `MASVS-STORAGE-1`, `MASVS-NETWORK-1`,
  `MASVS-PLATFORM-2`.

## Do

- Store every token/secret via `expo-secure-store`; clear it on logout.
- Treat every `EXPO_PUBLIC_*` value as world-readable before adding one.
- Allowlist deep-link schemes/hosts/paths; confirm before acting on one.
- Re-verify every mobile-side authz check against the API guard that
  actually enforces it.

## Don't

- Don't persist tokens/OTP/passwords in `AsyncStorage`, unencrypted MMKV,
  Zustand `persist`, or `redux-persist`.
- Don't disable TLS validation or log `Authorization` headers/sensitive bodies.
- Don't trust a client-side role check, a hidden screen, or a disabled
  button as an authorization boundary.
- Don't leave an Android component `exported="true"` or `allowBackup="true"`
  without a deliberate reason.
