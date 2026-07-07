---
name: expo-eas-pipeline
description: Use when configuring or modifying eas.json build/submit profiles, wiring EAS Update channels, or managing secrets/environment variables for apps/mobile releases. Pairs with mobile-testing-release for the pre-release checklist and docs/CI_CD.md for how the GitHub Actions workflows invoke these profiles.
---

# expo-eas-pipeline

EAS (Expo Application Services) configuration for `apps/mobile`: build
profiles, submit config, EAS Update channels, and secrets. This is
*configuration*, not CI orchestration — the workflows that invoke these
profiles live in `.github/workflows/eas-preview.yml` and
`eas-production.yml` (see `docs/CI_CD.md`).

## Goal

Three build profiles (`development`, `preview`, `production`) with distinct
distribution/channel behavior, no secret ever committed to `eas.json` or
`.env`, and an update channel model that lets JS-only fixes ship without a
full store resubmission.

## `eas.json` profiles

```json
{
  "cli": { "version": ">= 12.0.0", "appVersionSource": "remote" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "channel": "development"
    },
    "preview": {
      "distribution": "internal",
      "channel": "preview"
    },
    "production": {
      "channel": "production",
      "autoIncrement": true
    }
  },
  "submit": {
    "production": {}
  }
}
```

- **`development`** — a dev client build (`developmentClient: true`) for
  local iteration with Metro attached; installed via internal distribution
  (no store review needed).
- **`preview`** — internal distribution build off feature/`develop`
  branches, for QA/stakeholder review before anything goes to a store; the
  `preview` EAS Update channel targets exactly this build.
- **`production`** — store-bound build. `autoIncrement: true` lets EAS bump
  the build number automatically per `appVersionSource: "remote"`, so
  nobody has to remember to hand-edit `app.json` before every release.
- `submit.production` configures `eas submit` (store credentials are
  supplied via `eas credentials` / the Expo dashboard, never inline here).

## Build

```bash
# Local/manual (run in a real terminal — not from inside a Claude Code
# session; block-build-output.sh denies `eas build` in-session on purpose).
eas build --profile preview --platform all --non-interactive
eas build --profile production --platform all --non-interactive
```

- `--non-interactive` is required for CI (see `docs/CI_CD.md`'s
  `eas-preview.yml`/`eas-production.yml`); interactively it would otherwise
  prompt for credentials.
- Build per-platform (`--platform ios` / `--platform android`) when only
  one platform changed, to save build minutes; `--platform all` for a full
  release cut.

## Submit

```bash
eas submit --profile production --platform ios
eas submit --profile production --platform android
```

- Submission needs store credentials configured once via `eas credentials`
  (Apple: App Store Connect API key; Google: service account JSON) — stored
  by EAS, not in this repository.
- Run submit only after the corresponding build has been smoke-tested (see
  `mobile-testing-release`'s release checklist) — an automatic
  build-then-submit pipeline without a manual gate risks pushing an
  untested build straight to store review.

## EAS Update — channels

EAS Update lets a JS-only change (no native code/config plugin change) ship
to users without a new store build/review cycle. Channels map a running
build to the update stream it should receive:

```bash
eas update --branch preview --message "Fix feed pagination off-by-one"
eas update --branch production --message "Hotfix: crash on empty profile"
```

- A build's `channel` (set per-profile in `eas.json` above) determines which
  `eas update --branch <name>` pushes reach it — a `preview`-channel build
  only receives `preview`-branch updates, never `production` ones, and vice
  versa. Keep channel and branch names matched 1:1 to avoid an update
  silently going to the wrong audience.
- EAS Update is for JS/asset changes only — anything requiring a native
  rebuild (a new native module, a config plugin, a permission string
  change) needs a full `eas build` + store submission; pushing it as an
  update will not take effect and can leave the app in an inconsistent
  state.
- Production hotfixes via `eas update --branch production` are appropriate
  for urgent JS-only fixes, but still go through the same review discipline
  as a normal change — an update channel is a distribution mechanism, not a
  bypass of code review or testing.

## Secrets — EAS environment variables

Never commit API keys, the production `EXPO_PUBLIC_API_URL`, or any
credential to `.env` (gitignored, but still avoid ever having a real secret
touch disk in the repo) or to `eas.json`. Use EAS's own environment
variable store, scoped per environment:

```bash
eas env:create --scope project --environment production --name EXPO_PUBLIC_API_URL --value "https://api.example.com" --visibility plaintext
eas env:create --scope project --environment production --name SENTRY_DSN --value "..." --visibility sensitive
```

- `--visibility sensitive` for anything secret-like (API keys, DSNs);
  `plaintext` only for genuinely non-secret config (a public API base URL).
- Set the same variable name across `development`/`preview`/`production`
  environments with different values (e.g. `EXPO_PUBLIC_API_URL` pointing
  at localhost/staging/production respectively) — the build profile
  determines which environment's values a given build/update picks up.
- In CI (`.github/workflows/eas-preview.yml`, `eas-production.yml`), the
  `EXPO_TOKEN` secret (a GitHub Actions repo secret, not an EAS env var)
  authenticates the `eas` CLI itself — see `docs/CI_CD.md` for where that's
  configured. Don't confuse the two: `EXPO_TOKEN` authenticates the CLI;
  EAS env vars are the app's runtime configuration.

## Do

- Keep exactly three build profiles (`development`, `preview`,
  `production`) with distinct channels.
- Match EAS Update branch names to build-profile channel names 1:1.
- Store every secret via `eas env:create`/the Expo dashboard, never inline
  in `eas.json` or committed to `.env`.
- Smoke-test a `preview` build before promoting to `production` submit.

## Don't

- Don't run `eas build`/`eas submit` inside a Claude Code session — do it
  from a real terminal (the block-build hook denies `eas build` for this
  reason).
- Don't push a native-code-affecting change via `eas update` — it needs a
  full rebuild.
- Don't hardcode a secret value in `eas.json`, `app.json`, or `.env` and
  commit it.
- Don't let a build/submit pipeline run fully automatic with no manual
  smoke-test gate before production submission.
