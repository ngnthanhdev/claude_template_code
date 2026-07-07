---
name: mobile-i18n-theme
description: Use when adding translations/locale support (i18next + expo-localization) or defining/extending the light/dark theme token set in apps/mobile. Builds on the theme-provider plumbing from expo-router-nativewind — load that first if it doesn't exist yet.
---

# mobile-i18n-theme

Internationalization and theming for `apps/mobile`: `i18next` +
`expo-localization` for translated strings, and the light/dark color-token
system layered on NativeWind. Builds on `expo-router-nativewind`'s
`ThemeProvider` plumbing — this skill owns the token *values* and the
translation strings that plumbing renders.

## i18n setup

```bash
pnpm --filter mobile add i18next react-i18next expo-localization
```

```ts
// src/i18n/index.ts
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import * as Localization from "expo-localization";

import en from "./locales/en.json";
import es from "./locales/es.json";

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, es: { translation: es } },
  lng: Localization.getLocales()[0]?.languageCode ?? "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false }, // React already escapes
  returnNull: false,
});

export default i18n;
```

```json
// src/i18n/locales/en.json
{
  "feed": {
    "title": "Home",
    "empty": "Nothing here yet — check back soon."
  },
  "auth": {
    "signIn": "Sign in",
    "signInError": "Couldn't sign you in. Check your credentials and try again."
  }
}
```

```tsx
// usage in a screen/component
import { useTranslation } from "react-i18next";

function FeedHeader() {
  const { t } = useTranslation();
  return <Text className="text-xl font-semibold text-foreground">{t("feed.title")}</Text>;
}
```

- Initialize `i18n` once, imported from the root layout (side-effect
  import, same as Reanimated's `import "react-native-reanimated"` in
  `expo-router-nativewind`) so it's ready before any screen renders.
- Namespace keys by feature/screen (`feed.title`, `auth.signIn`) rather than
  a flat list — keeps large locale files navigable and avoids key
  collisions as the app grows.
- Never hardcode user-facing strings directly in a component once i18n is
  wired up — every string a user sees goes through `t()`, including error
  messages and empty states.
- Locale switching: expose a settings action that calls `i18n.changeLanguage(code)`
  and persist the choice (e.g. alongside the theme preference below) rather
  than relying solely on device locale detection, since a user may want the
  app in a different language than their OS.

## Theme tokens (light/dark, NativeWind)

`expo-router-nativewind` sets up the Tailwind config to read semantic color
tokens (`bg-background`, `text-foreground`, `bg-primary`, …) from CSS
variables rather than fixed values. This skill defines what those variables
resolve to per theme:

```css
/* global.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --color-background: 255 255 255;
  --color-foreground: 17 24 39;
  --color-primary: 37 99 235;
  --color-muted: 156 163 175;
}

.dark\:root {
  --color-background: 17 24 39;
  --color-foreground: 243 244 246;
  --color-primary: 96 165 250;
  --color-muted: 75 85 99;
}
```

Because NativeWind on React Native doesn't use CSS media queries at
runtime, drive the active variable set from the `ThemeProvider`'s `theme`
value by toggling a root-level class name (NativeWind's `dark:` variant
support) rather than relying on `prefers-color-scheme` alone:

```tsx
// src/theme/theme-provider.tsx (extends the plumbing from expo-router-nativewind)
import { createContext, useContext, useEffect, useState, type PropsWithChildren } from "react";
import { useColorScheme } from "react-native";
import * as SecureStore from "expo-secure-store";
import { vars } from "nativewind";

type Theme = "light" | "dark";

const themeVars = {
  light: vars({ "--color-background": "255 255 255", "--color-foreground": "17 24 39" }),
  dark: vars({ "--color-background": "17 24 39", "--color-foreground": "243 244 246" }),
};

const ThemeContext = createContext<{ theme: Theme; setTheme: (t: Theme) => void }>({
  theme: "light",
  setTheme: () => {},
});

export function ThemeProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme();
  const [theme, setTheme] = useState<Theme>(systemScheme === "dark" ? "dark" : "light");

  useEffect(() => {
    SecureStore.getItemAsync("ui.themeOverride").then((saved) => {
      if (saved === "light" || saved === "dark") setTheme(saved);
    });
  }, []);

  const updateTheme = (next: Theme) => {
    setTheme(next);
    SecureStore.setItemAsync("ui.themeOverride", next);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme: updateTheme }}>
      <View style={themeVars[theme]} className="flex-1">
        {children}
      </View>
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
```

- Persist a manual theme override the same lightweight way as other small
  UI preferences (SecureStore or `AsyncStorage` — this is not a secret, so
  either is acceptable, but be consistent with wherever other preferences
  live); fall back to `useColorScheme()` (system setting) when no override
  is saved.
- Keep every color a component uses as a semantic Tailwind class
  (`bg-background`, `text-foreground`) never a literal hex or `dark:`
  ad hoc override per component — the token layer is what makes a future
  rebrand or a third theme (e.g. high-contrast) a config change, not a
  find-and-replace across the codebase.

## RTL note

If the product ships a right-to-left locale (Arabic, Hebrew, etc.):

- Call `I18nManager.forceRTL(true)` and `I18nManager.allowRTL(true)` — this
  requires an app reload (`Updates.reloadAsync()` or a restart prompt) to
  take effect, it cannot flip live mid-session.
- Prefer NativeWind's logical properties (`ps-4`/`pe-4` for
  padding-start/end, `text-start`/`text-end`) over directional ones
  (`pl-4`/`text-left`) wherever layout should mirror in RTL — directional
  utilities do not auto-flip.
- Test RTL screens explicitly (a Maestro flow or manual pass with a device
  set to an RTL locale, see `mobile-testing-release`) — RTL bugs are easy to
  miss when the primary development locale is LTR.
- If the project's approved spec (`docs/specs/`) doesn't call for RTL
  support, don't build this speculatively — note it as a non-goal instead.

## Do

- Namespace translation keys by feature/screen.
- Initialize i18n once at app boot, before any screen renders.
- Drive theme tokens through CSS variables / NativeWind's `vars()`, keyed
  off one `ThemeProvider` state, not per-component `dark:` overrides.
- Persist a manual theme override; fall back to system `useColorScheme()`.

## Don't

- Don't hardcode user-facing strings once i18n is wired up.
- Don't hardcode hex colors in components — use the semantic token classes.
- Don't assume `prefers-color-scheme`-only theming works on native — drive
  it explicitly from the provider.
- Don't build RTL support the project's approved spec doesn't call for.
