---
name: mobile-patterns
description: All apps/mobile feature patterns in one skill — screen composition and navigation, auth flows and secure token storage, TanStack Query API integration against @shared contracts, react-hook-form + zod forms and FlashList lists, i18n and light/dark theming. Load the SKILL.md for routing and core rules, then read ONLY the references/ file matching the task.
---

# Mobile patterns

One skill for `apps/mobile` feature work. **Do not read every reference —
pick the one(s) the task actually touches:**

| Task touches… | Read |
|---|---|
| Screen composition, Expo Router navigation, device APIs, perf guardrails | `references/app-composition.md` |
| Auth flows, `expo-secure-store` tokens, persisted session store | `references/auth-state.md` |
| API calls, TanStack Query, typed client over `@shared` zod contracts | `references/api-integration.md` |
| Forms (`react-hook-form` + zod), FlashList lists, optimistic updates | `references/data-forms.md` |
| i18n strings, light/dark theme tokens with NativeWind | `references/i18n-theme.md` |

Foundation setup (root layout, NativeWind config, Reanimated/New Arch
wiring) is a separate skill: `expo-router-nativewind`. Animation work is
`animations`. Testing/release is `mobile-testing-release`.

## Core rules (apply to every mobile task)

- Types and runtime validation come from `packages/shared` zod schemas —
  never redefine a request/response shape locally (Article VII).
- Tokens/credentials only in `expo-secure-store`; nothing sensitive in
  `EXPO_PUBLIC_*` (Article V/VI — see the `security` skill for review).
- Lists of unknown length use FlashList, images use `expo-image`.
- Keep the JS thread free during interactions — heavy work goes off-thread
  or into Reanimated worklets (see `animations`).
- Strict TypeScript, no `any` (Article III).
