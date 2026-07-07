---
name: mobile-api-integration
description: Use when wiring apps/mobile screens/hooks to apps/api endpoints — TanStack Query setup, the typed API client, retry/error handling, or offline cache/invalidation. Pairs with shared-contracts for the zod schemas the client validates against, and mobile-auth-state for the token-refresh interceptor.
---

# mobile-api-integration

How `apps/mobile` talks to `apps/api`: a typed API client that validates
every response against the `packages/shared` zod contracts, TanStack Query
for caching/loading/error state, retry policy, and offline-aware cache
behavior.

## Goal

No screen calls `fetch` directly. Every network call goes through one typed
client, every response shape is validated against the same zod schema the
NestJS side uses for its DTOs, and every read is a `useQuery` (cached,
deduped, revalidated) rather than a manual `useEffect` + `useState` fetch.

## The typed API client

```ts
// src/api/client.ts
import { z } from "zod";
import { secureTokens } from "@/auth/secure-tokens";
import { tryRefreshSession } from "@/auth/refresh";
import { useAuthStore } from "@/auth/auth-store";

const API_URL = process.env.EXPO_PUBLIC_API_URL;

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<TSchema extends z.ZodTypeAny>(
  path: string,
  schema: TSchema,
  init?: RequestInit,
): Promise<z.infer<TSchema>> {
  // Tokens live only in expo-secure-store (see mobile-auth-state) — never
  // read them out of the Zustand session store, which holds status/user only.
  const { accessToken, refreshToken } = await secureTokens.get();
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init?.headers,
    },
  });

  if (res.status === 401 && refreshToken) {
    const refreshed = await tryRefreshSession(refreshToken);
    if (!refreshed) {
      await useAuthStore.getState().signOut();
      throw new ApiError(401, "Session expired");
    }
    return request(path, schema, init); // retry once, with the new token
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.message ?? res.statusText);
  }

  const json = await res.json();
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    // A schema mismatch means mobile and api drifted — fail loudly in dev,
    // never silently coerce or ignore it.
    throw new Error(`API contract mismatch on ${path}: ${parsed.error.message}`);
  }
  return parsed.data;
}

export const apiClient = {
  get: <T extends z.ZodTypeAny>(path: string, schema: T) => request(path, schema),
  post: <T extends z.ZodTypeAny>(path: string, schema: T, body: unknown) =>
    request(path, schema, { method: "POST", body: JSON.stringify(body) }),
  patch: <T extends z.ZodTypeAny>(path: string, schema: T, body: unknown) =>
    request(path, schema, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T extends z.ZodTypeAny>(path: string, schema: T) =>
    request(path, schema, { method: "DELETE" }),
};
```

- The **schema argument is not optional** — every call site validates its
  response, so a backend contract change breaks loudly in the client that
  consumes it instead of shipping an untyped `any` through the app.
- Import request/response schemas from `@shared/contracts/*`
  (`shared-contracts`) — never redeclare a parallel shape on the mobile side.
- The 401 → refresh → retry-once flow here calls into `mobile-auth-state`'s
  deduped `tryRefreshSession`; don't reimplement refresh logic per call site.

## TanStack Query setup

```tsx
// src/api/query-client.ts
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status < 500) return false; // don't retry 4xx
        return failureCount < 2;
      },
      networkMode: "offlineFirst", // serve cache immediately, revalidate when back online
    },
    mutations: {
      networkMode: "offlineFirst",
    },
  },
});
```

```tsx
// app/_layout.tsx (added inside expo-router-nativewind's providers)
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/api/query-client";

// <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
```

- `networkMode: "offlineFirst"` means queries resolve from cache
  immediately when offline instead of hanging in a loading state — pair
  with `mobile-app-agent`'s `useIsOnline()` banner for user-visible offline
  indication.
- Only retry 5xx/network errors, never 4xx — a 404/401/422 won't succeed on
  retry and retrying it just wastes battery and adds latency to the error
  the user needs to see.

## Query hooks

```ts
// src/api/hooks/use-feed.ts
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { feedResponseSchema } from "@shared/contracts/feed";

export function useFeed() {
  return useQuery({
    queryKey: ["feed"],
    queryFn: () => apiClient.get("/feed", feedResponseSchema),
  });
}
```

- One hook per resource/screen need, named `use<Resource>` — screens call
  the hook, never `apiClient` directly (keeps the client swappable and the
  query key structure centralized).
- Structure query keys as arrays with the resource first
  (`["feed"]`, `["post", postId]`, `["post", postId, "comments"]`) so
  invalidation can target a resource family with a prefix match.

## Mutations and invalidation

```ts
// src/api/hooks/use-create-post.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { createPostRequestSchema, postSchema } from "@shared/contracts/post";
import type { z } from "zod";

export function useCreatePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: z.infer<typeof createPostRequestSchema>) =>
      apiClient.post("/posts", postSchema, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feed"] });
    },
  });
}
```

- Invalidate the narrowest key that covers everything the mutation could
  have affected — invalidating `["feed"]` after a new post, not the entire
  cache.
- See `mobile-data-forms` for the optimistic-update variant of this same
  pattern (updating the cache immediately, rolling back on error).

## Do

- Route every network call through the typed client; validate every
  response against a `@shared` zod schema.
- Use `useQuery`/`useMutation`, never manual `useEffect` fetch + `useState`.
- Structure query keys as arrays, resource-first, so invalidation can target
  a family.
- Only retry 5xx/network failures, never 4xx.
- Serve from cache first (`offlineFirst`) and revalidate in the background.

## Don't

- Don't call `fetch` from a screen or component directly.
- Don't skip schema validation on a response "because it's a quick screen."
- Don't reimplement token refresh per call site — reuse
  `mobile-auth-state`'s deduped refresh.
- Don't invalidate the entire query cache after a narrow mutation.
- Don't retry 4xx responses.
