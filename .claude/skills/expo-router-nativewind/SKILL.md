---
name: expo-router-nativewind
description: Use when scaffolding apps/mobile for the first time, or touching the root layout, navigation shell, NativeWind/Tailwind config, theming provider, or New Architecture setup — this is the foundation every other mobile skill builds on. Load it before mobile-app-agent, mobile-auth-state, or any screen-level work if the foundation isn't in place yet.
---

# expo-router-nativewind

This is the **foundation skill** for `apps/mobile`. Every other mobile skill
(`mobile-app-agent`, `mobile-auth-state`, `mobile-api-integration`,
`mobile-data-forms`, `mobile-i18n-theme`, `mobile-testing-release`,
`expo-eas-pipeline`, `mobile-animations`) assumes the root layout, NativeWind
config, and New Architecture setup described here already exist. If
`apps/mobile` is empty or missing any of this, build it here first — don't
let a feature task quietly half-invent its own root layout.

## Goal

A working Expo Router app shell with:

- File-based routing (`app/`) with route groups for `(auth)` vs `(app)`.
- `SafeAreaProvider` and `GestureHandlerRootView` wrapping the whole tree.
- Reanimated 4 configured, including the **New Architecture** requirement and
  the separate `react-native-worklets` package.
- NativeWind wired through Tailwind config, Metro config, and Babel config.
- A theme provider exposing light/dark tokens (paired with
  `mobile-i18n-theme` for the token *contents*; this skill owns the
  *plumbing*).

## Required dependencies

```bash
pnpm --filter mobile add \
  react-native-reanimated@^4 react-native-worklets react-native-gesture-handler \
  react-native-safe-area-context react-native-screens \
  nativewind tailwindcss \
  expo-router expo-linking expo-constants expo-status-bar
```

`react-native-worklets` is a **separate package in Reanimated v4** — v3's
setup (worklets bundled inside `react-native-reanimated` itself) does not
apply. Both packages must be present or Reanimated animations silently fail
to run on the UI thread.

## New Architecture is mandatory

Reanimated 4 requires Fabric (the New Architecture). Without it, the app
either crashes at startup or animations silently no-op. Set this in
`app.json` (or `app.config.ts`) before anything else:

```json
{
  "expo": {
    "name": "mobile",
    "slug": "mobile",
    "newArchEnabled": true,
    "ios": { "supportsTablet": true },
    "android": { "adaptiveIcon": { "foregroundImage": "./assets/adaptive-icon.png" } },
    "plugins": ["expo-router"]
  }
}
```

Do not scaffold `apps/mobile` and defer this flag "for later" — a project
built without it will need every native module reinstalled once flipped on.

## Babel config

```js
// babel.config.js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    plugins: [
      // react-native-worklets' Babel plugin MUST be last.
      "react-native-worklets/plugin",
    ],
  };
};
```

The worklets Babel plugin must be the **last** plugin in the list — it
rewrites worklet functions after every other transform has run.

## Metro config (NativeWind)

```js
// metro.config.js
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: "./global.css" });
```

## Tailwind config

```js
// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Semantic tokens, not raw hexes, so mobile-i18n-theme's light/dark
        // pairs can swap the *value* without touching call sites.
        background: "rgb(var(--color-background) / <alpha-value>)",
        foreground: "rgb(var(--color-foreground) / <alpha-value>)",
        primary: "rgb(var(--color-primary) / <alpha-value>)",
        muted: "rgb(var(--color-muted) / <alpha-value>)",
      },
    },
  },
  plugins: [],
};
```

```css
/* global.css */
@tailwind base;
@tailwind components;
@tailwind utilities;
```

## Root layout

```tsx
// app/_layout.tsx
import "../global.css";
import "react-native-reanimated";

import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { ThemeProvider } from "@/theme/theme-provider";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <StatusBar style="auto" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(app)" />
          </Stack>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
```

`import "react-native-reanimated"` at the very top of the root layout (before
any other Reanimated-dependent import) is required — it installs the
Reanimated runtime before anything tries to use a shared value or worklet.

## Route groups

```
app/
├── _layout.tsx            # root: providers + Stack
├── (auth)/
│   ├── _layout.tsx         # Stack for unauthenticated screens
│   ├── sign-in.tsx
│   └── sign-up.tsx
└── (app)/
    ├── _layout.tsx         # Tabs/Stack for authenticated screens, auth-gated
    ├── (tabs)/
    │   ├── _layout.tsx
    │   ├── index.tsx
    │   └── profile.tsx
    └── settings.tsx
```

Route groups (`(auth)`, `(app)`) don't affect the URL — they're purely
organizational and let each area own its own layout/navigator. The
auth-gating redirect itself (checking session state and routing between
`(auth)` and `(app)`) is owned by `mobile-auth-state`, not this skill — this
skill only sets up the groups so that logic has somewhere to attach.

## Theme provider (plumbing only)

```tsx
// src/theme/theme-provider.tsx
import { createContext, useContext, useState, type PropsWithChildren } from "react";
import { useColorScheme } from "react-native";

type Theme = "light" | "dark";
const ThemeContext = createContext<{ theme: Theme; setTheme: (t: Theme) => void }>({
  theme: "light",
  setTheme: () => {},
});

export function ThemeProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme();
  const [theme, setTheme] = useState<Theme>(systemScheme === "dark" ? "dark" : "light");
  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
```

The actual color token values (the `--color-*` CSS variables per theme) and
persistence of a manual override are `mobile-i18n-theme`'s job — this
provider is the wiring both plug into.

## Do

- Set `newArchEnabled: true` before installing any other native module.
- Keep the worklets Babel plugin last in `babel.config.js`.
- Wrap the whole tree once, at the root layout, with
  `GestureHandlerRootView` and `SafeAreaProvider` — never re-wrap per screen.
- Use route groups (`(auth)`, `(app)`) to separate navigators by auth state.
- Use semantic Tailwind color tokens (`bg-background`, `text-foreground`)
  instead of raw Tailwind palette colors, so theming stays centralized.

## Don't

- Don't add Reanimated without `react-native-worklets` — v3 tutorials that
  say "worklets are built in" are wrong for v4.
- Don't scaffold the app with `newArchEnabled: false` "to save time" — every
  native dependency has to be reinstalled once it's flipped on later.
- Don't put `GestureHandlerRootView` inside individual screens; gestures
  outside its subtree silently fail to register.
- Don't hardcode colors in components — read `mobile-i18n-theme` for the
  token system this config plugs into.
