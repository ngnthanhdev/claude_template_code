---
name: mobile-app-agent
description: Use when composing or modifying a screen in apps/mobile — layout, Expo Router navigation between screens, device API/permission access, offline-aware state, or list/scroll performance. This is the general-purpose mobile screen-building skill; load the foundation skill (expo-router-nativewind) first if the root layout/NativeWind config isn't set up yet.
---

# mobile-app-agent

The general-purpose skill for building and modifying screens in
`apps/mobile`. Assumes `expo-router-nativewind` has already set up the root
layout, NativeWind, and New Architecture — this skill is about what happens
*inside* a screen: composition, navigation, device APIs, offline-aware
state, and performance.

## Goal

Every screen should be: composed from small, typed components; navigated to
via Expo Router (`Link`/`router.push`, never ad hoc state machines that
fight the navigator); resilient to no/slow network; and fast — no dropped
frames from avoidable JS-thread work.

## Screen composition

Keep screen files thin — a screen file wires data + navigation + layout;
the actual UI lives in `src/components/`.

```tsx
// app/(app)/(tabs)/index.tsx
import { View } from "react-native";
import { FeedList } from "@/components/feed/feed-list";
import { ScreenHeader } from "@/components/layout/screen-header";

export default function FeedScreen() {
  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title="Home" />
      <FeedList />
    </View>
  );
}
```

- One screen = one route file. Don't put business logic or data fetching
  directly in the screen component — push it into a hook
  (`mobile-api-integration`) so the screen stays a thin composition layer.
- Prefer NativeWind `className` over `StyleSheet.create` for layout/spacing/
  color; drop to `StyleSheet` only for values NativeWind can't express
  (e.g. values driven by a Reanimated shared value).

## Navigation

Use Expo Router's file-based conventions and typed navigation, not manual
state:

```tsx
import { Link, router } from "expo-router";

// Declarative — preferred for anything rendered (buttons, list items)
<Link href={{ pathname: "/(app)/post/[id]", params: { id: post.id } }}>
  <PostCard post={post} />
</Link>;

// Imperative — for navigation as a *result* of an action (submit, mutation success)
function onSubmit() {
  router.replace("/(app)/(tabs)");
}
```

- Use dynamic segments (`app/(app)/post/[id].tsx`) for detail screens rather
  than passing whole objects through navigation params — pass an id, refetch
  or read from the query cache (`mobile-api-integration`) on the detail
  screen.
- Use `router.replace` (not `router.push`) after auth transitions or form
  submits that shouldn't leave a "back" entry to a stale state.
- Modals: use Expo Router's `presentation: "modal"` screen option rather
  than a hand-rolled `Modal` component, so back-gesture and Android
  hardware-back behavior stay consistent with the rest of the navigator.

## Device APIs and permissions

Every device API access follows the same shape: check/request permission,
handle denial explicitly, only then call the API.

```tsx
import * as ImagePicker from "expo-image-picker";

async function pickAvatar() {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== "granted") {
    // Surface a real message — don't fail silently or retry-loop the prompt.
    showToast("Photo library access is needed to set an avatar.");
    return;
  }
  const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });
  if (!result.canceled) {
    // upload result.assets[0]
  }
}
```

- Declare the permission's usage string in `app.json` (`ios.infoPlist` /
  `android.permissions` or the relevant Expo config plugin) — an
  undeclared permission crashes on iOS rather than prompting.
- Never call a permissioned API speculatively on screen mount "just in
  case" — request permission at the point of the action that needs it, so
  the OS prompt has context the user understands.
- Common APIs: `expo-image-picker` (photos), `expo-location`,
  `expo-notifications` (push), `expo-camera`, `expo-contacts`. Each has its
  own permission call — don't assume one grant covers another.

## Offline-aware state

Mobile networks are unreliable; a screen should degrade gracefully rather
than spinner-lock or crash.

```tsx
import NetInfo from "@react-native-community/netinfo";
import { useEffect, useState } from "react";

function useIsOnline() {
  const [isOnline, setIsOnline] = useState(true);
  useEffect(() => {
    return NetInfo.addEventListener((state) => setIsOnline(Boolean(state.isConnected)));
  }, []);
  return isOnline;
}
```

- Combine with TanStack Query's cache (`mobile-api-integration`): render
  cached data even when offline, and show a small persistent banner rather
  than blocking the whole screen behind a "no connection" state.
- Disable (don't hide) actions that require connectivity when offline, with
  a reason ("Reconnect to post") rather than letting them silently fail.
- Queue-and-retry for writes is `mobile-api-integration` + `mobile-data-forms`'s
  job (optimistic updates + mutation retry) — this skill is about the
  screen-level *presentation* of online/offline state.

## Performance guardrails

The JS thread is shared with Reanimated's UI-thread work is not, but
anything left running on JS (unoptimized re-renders, heavy list rendering,
JSON parsing on every keystroke) still causes dropped frames and janky
gesture response.

- **Lists:** always use `@shopify/flash-list`'s `FlashList`, never
  `FlatList` or, worse, `ScrollView` + `.map()`, for any list that can grow
  past a screenful.

  ```tsx
  import { FlashList } from "@shopify/flash-list";

  <FlashList
    data={posts}
    renderItem={({ item }) => <PostCard post={item} />}
    estimatedItemSize={120}
    keyExtractor={(item) => item.id}
  />;
  ```

  `estimatedItemSize` is not optional — an inaccurate estimate defeats
  FlashList's recycling and regresses to `FlatList`-like performance.

- **Memoization:** wrap list-item components in `React.memo`, and any
  callback/derived value passed into them in `useCallback`/`useMemo`, so a
  parent re-render (e.g. a new post arriving) doesn't re-render every
  already-rendered row.
- **Avoid JS-thread work in hot paths:** don't do expensive computation
  (sorting, filtering, formatting) inline in `renderItem` — precompute it
  once when the data changes, not once per render per row.
- **Images:** use `expo-image`, not `Image` from `react-native` — it caches
  and decodes off the JS thread and supports blurhash placeholders.
- **Animations:** anything that must track a gesture (scroll, pan, drag)
  belongs on the UI thread via Reanimated worklets, not `Animated` or
  manual `setState` per frame — see `mobile-animations`.

## Do

- Keep screens thin; push logic into hooks and components.
- Use Expo Router navigation primitives (`Link`, `router.push/replace`),
  never a hand-rolled navigation stack.
- Request permissions at the point of use, with an explicit denial path.
- Use `FlashList` + `expo-image` + memoization for any non-trivial list.

## Don't

- Don't fetch data directly inside a screen component body — that's
  `mobile-api-integration`'s hook layer.
- Don't pass large objects through route params — pass an id.
- Don't request a permission on mount speculatively.
- Don't use `FlatList`/`ScrollView.map()` for growable lists, or skip
  `estimatedItemSize` on `FlashList`.
- Don't do per-frame work (gesture tracking, scroll-driven transforms) in
  JS-thread state — see `mobile-animations` for the UI-thread pattern.
