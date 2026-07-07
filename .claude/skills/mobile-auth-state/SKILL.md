---
name: mobile-auth-state
description: Use when implementing sign-in/sign-up flows, token storage, session refresh, auth-gated routes, or the persisted auth store in apps/mobile. Load expo-router-nativewind first if the route groups/root layout aren't set up yet, and shared-contracts for the auth request/response zod schemas.
---

# mobile-auth-state

Auth flows for `apps/mobile`: sign-in/sign-up screens, secure token storage,
refresh-token rotation, gating navigation on session state, and a persisted
session store. Consumes the auth zod schemas from `packages/shared`
(`shared-contracts`) and the API client from `mobile-api-integration`.

## Goal

A session that: stores tokens in the OS keychain (never `AsyncStorage`,
never in JS memory only); survives app restarts (persisted, rehydrated on
launch); refreshes access tokens transparently before they expire or on a
401; and gates the `(app)` route group so an unauthenticated user can never
land on an authenticated screen, even via deep link.

## Token storage — `expo-secure-store`

Access and refresh tokens are secrets. Store them in the platform keychain
via `expo-secure-store`, not `AsyncStorage` (unencrypted) and not component
state (lost on reload, not shared across the app).

```ts
// src/auth/secure-tokens.ts
import * as SecureStore from "expo-secure-store";

const ACCESS_TOKEN_KEY = "auth.accessToken";
const REFRESH_TOKEN_KEY = "auth.refreshToken";

export const secureTokens = {
  async get() {
    const [accessToken, refreshToken] = await Promise.all([
      SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
      SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
    ]);
    return { accessToken, refreshToken };
  },
  async set(accessToken: string, refreshToken: string) {
    await Promise.all([
      SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken),
      SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken),
    ]);
  },
  async clear() {
    await Promise.all([
      SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
      SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
    ]);
  },
};
```

- `expo-secure-store` values must be strings — serialize/deserialize
  anything structured (e.g. `JSON.stringify`) rather than storing objects
  directly.
- Never log a token, put it in a Sentry/analytics breadcrumb, or pass it
  through a navigation param.

## Persisted session store (Zustand)

The in-memory session (user, auth status) lives in a Zustand store; the
*tokens* live in SecureStore (above), not in the Zustand-persisted state —
keep secrets out of anything that could end up in `AsyncStorage`-backed
persistence middleware.

```ts
// src/auth/auth-store.ts
import { create } from "zustand";
import { secureTokens } from "./secure-tokens";
import type { AuthUser } from "@shared/contracts/auth";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
  signIn: (user: AuthUser, accessToken: string, refreshToken: string) => Promise<void>;
  signOut: () => Promise<void>;
  hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  status: "loading",
  user: null,

  async hydrate() {
    const { accessToken, refreshToken } = await secureTokens.get();
    if (!accessToken || !refreshToken) {
      set({ status: "unauthenticated", user: null });
      return;
    }
    // Validate/refresh against the API before trusting a stored token.
    const result = await tryRefreshSession(refreshToken);
    if (!result) {
      await secureTokens.clear();
      set({ status: "unauthenticated", user: null });
      return;
    }
    set({ status: "authenticated", user: result.user });
  },

  async signIn(user, accessToken, refreshToken) {
    await secureTokens.set(accessToken, refreshToken);
    set({ status: "authenticated", user });
  },

  async signOut() {
    await secureTokens.clear();
    set({ status: "unauthenticated", user: null });
  },
}));
```

- `hydrate()` runs once on app boot (root layout effect) and drives the
  `status: "loading"` state that the route guard below waits on — never
  render the auth-gated navigator before hydration resolves, or a logged-out
  user briefly flashes an authenticated screen (or vice versa).
- Keep `AuthUser` and the sign-in/refresh request/response shapes as zod
  schemas in `packages/shared` (`shared-contracts`), inferred on both mobile
  and API — never hand-roll a duplicate interface on the mobile side.

## Refresh-token flow

Refresh proactively (before expiry) and reactively (on a 401), both funneled
through one function so there's a single place that can dedupe concurrent
refresh attempts:

```ts
// src/auth/refresh.ts
let refreshPromise: Promise<{ accessToken: string } | null> | null = null;

export async function tryRefreshSession(refreshToken: string) {
  if (!refreshPromise) {
    refreshPromise = apiClient
      .post("/auth/refresh", { refreshToken })
      .then((res) => res.data)
      .catch(() => null)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}
```

- Deduping matters: if three API calls all 401 around the same time,
  without this, three parallel refresh requests race and can invalidate
  each other's rotated refresh token server-side.
- Wire this into the API client's response interceptor (see
  `mobile-api-integration`) so a 401 triggers exactly one refresh, then
  retries the original request(s) once.
- If refresh itself fails (expired/revoked refresh token), sign the user out
  (`useAuthStore.getState().signOut()`) rather than looping retries.

## Auth-gated routes

Gate the `(app)` route group at the layout level, not per-screen, so a new
screen added under `(app)` is protected automatically:

```tsx
// app/(app)/_layout.tsx
import { Redirect, Stack } from "expo-router";
import { useAuthStore } from "@/auth/auth-store";
import { SplashScreen } from "@/components/splash-screen";

export default function AppLayout() {
  const status = useAuthStore((s) => s.status);

  if (status === "loading") return <SplashScreen />;
  if (status === "unauthenticated") return <Redirect href="/(auth)/sign-in" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
```

```tsx
// app/(auth)/_layout.tsx — the inverse guard, so a signed-in user can't
// navigate back to sign-in via deep link.
import { Redirect, Stack } from "expo-router";
import { useAuthStore } from "@/auth/auth-store";

export default function AuthLayout() {
  const status = useAuthStore((s) => s.status);
  if (status === "authenticated") return <Redirect href="/(app)/(tabs)" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- Guard **both directions**: unauthenticated users redirected out of
  `(app)`, authenticated users redirected out of `(auth)`. A deep link
  (push notification, universal link) can land on either group directly, so
  the guard must not assume normal in-app navigation got the user there.

## Do

- Store tokens exclusively in `expo-secure-store`.
- Hydrate the session once at boot and block the gated navigator on a
  `"loading"` status until it resolves.
- Dedupe concurrent refresh attempts behind one in-flight promise.
- Gate both `(auth)` and `(app)` layouts, not just one direction.
- Share the auth zod schemas from `packages/shared` with the API.

## Don't

- Don't store tokens in `AsyncStorage`, Zustand-persisted state, or React
  state alone.
- Don't render the authenticated navigator before hydration resolves.
- Don't let multiple 401s trigger multiple parallel refresh calls.
- Don't duplicate the `AuthUser`/request-response types on the mobile side —
  import the inferred types from `@shared/*`.
- Don't retry a failed refresh silently forever — sign out on refresh
  failure.
