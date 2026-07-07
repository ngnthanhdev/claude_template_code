---
name: mobile-animations
description: Use when implementing animations, gestures, transitions, or premium visual effects in apps/mobile (Reanimated v4) — scroll-driven card effects, swipe-to-dismiss/morph interactions, pan/pinch/fling gestures, carousels, or Skia particle/shader/blur effects. This is the HOW (recipes/snippets); load motion-design-principles first to decide WHETHER an animation belongs here at all.
---

# mobile-animations

A recipe library for `apps/mobile` animation, gesture, and effects work,
built on **React Native Reanimated 4**. Every recipe below is a real,
copy-adjustable snippet, not pseudocode — but every recipe also assumes you
already asked (and answered) "should this animate at all?" via
`motion-design-principles`. That skill owns the *taste* call (when/why);
this skill owns the *implementation* (how). Don't skip straight here from a
"make it feel alive" request — check the taste layer first, then come back.

For anything not covered by these recipes — deeper Reanimated internals,
worklet edge cases, advanced gesture composition, 120fps profiling — read
the vendored `react-native-best-practices` skill
(`.claude/skills/react-native-best-practices`); it's the authoritative deep
source this recipe library summarizes into task-shaped snippets.

## Setup gotchas

These are foundation-level facts (`expo-router-nativewind` should already
have wired the first two); restated here because getting any of them wrong
makes every recipe below silently fail.

- **Reanimated 4 requires the New Architecture (Fabric).** `newArchEnabled:
  true` must be set in `app.json`/`app.config.ts` before any of these
  recipes are added. On the old architecture, Reanimated 4 either fails to
  install or animations silently no-op — there is no graceful degradation.
- **Worklets are a separate package in v4.** Install both
  `react-native-reanimated@^4` *and* `react-native-worklets`, and keep
  `react-native-worklets/plugin` as the **last** entry in
  `babel.config.js`'s `plugins` array. A v3-era setup that only installs
  `react-native-reanimated` will fail to run anything on the UI thread.
- **Honor `useReducedMotion()`.** Every non-trivial animation in this file
  should branch on it — collapse to an instant state change or a short fade
  instead of the full motion when the user has Reduce Motion enabled:

  ```tsx
  import { useReducedMotion, withTiming } from "react-native-reanimated";

  const reduceMotion = useReducedMotion();

  translateY.value = reduceMotion
    ? withTiming(target, { duration: 0 })
    : withSpring(target);
  ```

- **Library list** (installed once at the foundation layer):
  - `react-native-reanimated@^4` — shared values, worklets, layout
    animations, `useAnimatedScrollHandler`/`useScrollViewOffset`.
  - `react-native-gesture-handler` — `Gesture.Pan()`/`Pinch()`/`Fling()`,
    composed via `GestureDetector`.
  - `react-native-worklets` — the worklet runtime v4 split out of core.
  - `@shopify/flash-list` — virtualized lists (see `mobile-app-agent` for
    the baseline `FlashList` setup this file's scroll recipes build on).
  - `expo-image` — GPU-decoded images with blurhash placeholders, used
    inside animated cards instead of `Image`.
  - `@shopify/react-native-skia` — GPU canvas for particles, shaders, blur,
    fluid morphs.
  - `react-native-reanimated-carousel` — prebuilt 3D/stack/parallax
    carousel modes.
  - Optional: `moti` — declarative wrapper over Reanimated for simple
    enter/exit animations; skip it for anything in this file that needs
    per-frame gesture tracking, where raw Reanimated is clearer.
  - **No 3D engine.** Depth is perspective transforms (`{ perspective }` +
    `rotateX`/`rotateY`) plus Skia's 2D GPU canvas — not
    `@react-three/fiber`/`filament`. A project that genuinely needs 3D
    scenes adds that stack explicitly in its own Phase 0 design doc; it is
    not part of this template's default animation stack.

## Recipe: Scroll-driven 3D cards

Check `motion-design-principles` first — this recipe communicates scroll
*position* (which card is "focused") and is appropriate for a bounded
featured-cards section or onboarding-style scroller, not for decorating
every row of a long virtualized feed.

```tsx
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  interpolate,
  Extrapolation,
  type SharedValue,
} from "react-native-reanimated";

const CARD_HEIGHT = 220;

function ScrollCard3D({
  item,
  index,
  scrollY,
}: {
  item: FeaturedItem;
  index: number;
  scrollY: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => {
    const inputRange = [
      (index - 1) * CARD_HEIGHT,
      index * CARD_HEIGHT,
      (index + 1) * CARD_HEIGHT,
    ];
    const rotateX = interpolate(
      scrollY.value,
      inputRange,
      [15, 0, -15],
      Extrapolation.CLAMP,
    );
    const scale = interpolate(scrollY.value, inputRange, [0.92, 1, 0.92], Extrapolation.CLAMP);
    const translateY = interpolate(scrollY.value, inputRange, [18, 0, 18], Extrapolation.CLAMP);
    return {
      // `perspective` must come first in the array — it sets the depth
      // that the subsequent rotate entries are projected against.
      transform: [
        { perspective: 800 },
        { rotateX: `${rotateX}deg` },
        { scale },
        { translateY },
      ],
    };
  });

  return (
    <Animated.View style={[styles.card, style]}>
      <FeaturedCardContent item={item} />
    </Animated.View>
  );
}

export function ScrollDriven3DCards({ data }: { data: FeaturedItem[] }) {
  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  return (
    <Animated.ScrollView onScroll={scrollHandler} scrollEventThrottle={16}>
      {data.map((item, index) => (
        <ScrollCard3D key={item.id} item={item} index={index} scrollY={scrollY} />
      ))}
    </Animated.ScrollView>
  );
}
```

An equivalent, slightly newer-style API avoids the scroll handler entirely:
`const ref = useAnimatedRef<Animated.ScrollView>(); const scrollY =
useScrollViewOffset(ref);` then pass `ref={ref}` to the `Animated.ScrollView`
— pick whichever reads clearer in context; both drive the same
`useAnimatedStyle` shape above.

**Perf caveat:** this pattern computes every card's transform from one
shared `scrollY`, which only works cleanly for a small, fully-mounted set of
cards (a featured strip, an onboarding sequence). It does **not** compose
with `FlashList`'s recycling — a virtualized long feed that wants
scroll-reactive per-row transforms needs a different approach (track offset
relative to each row's own measured position, or fall back to a simpler
opacity/scale fade that tolerates recycled instances). Don't bolt this onto
`mobile-app-agent`'s `FlashList` feed and expect it to behave the same.

## Recipe: Swipe-to-island morph

Check `motion-design-principles` first — this recipe is a good fit for
"dismiss/handle this later" actions that benefit from continuity (the item
visibly relocates rather than vanishing), not for routine list-row taps.

```tsx
import { useState } from "react";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import Animated, {
  LinearTransition,
  FadeIn,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from "react-native-reanimated";

const ISLAND_DISMISS_THRESHOLD = -80;

function SwipeableRow({
  item,
  onSendToIsland,
}: {
  item: TaskItem;
  onSendToIsland: (item: TaskItem) => void;
}) {
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(1);

  const pan = Gesture.Pan()
    .activeOffsetY([-10, 10])
    .onUpdate((e) => {
      translateY.value = Math.min(0, e.translationY);
    })
    .onEnd((e) => {
      if (e.translationY < ISLAND_DISMISS_THRESHOLD) {
        translateY.value = withSpring(-160);
        opacity.value = withSpring(0, undefined, (finished) => {
          if (finished) runOnJS(onSendToIsland)(item);
        });
      } else {
        translateY.value = withSpring(0);
      }
    });

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        layout={LinearTransition.springify()}
        exiting={FadeOut.duration(200)}
        style={[styles.row, style]}
      >
        <TaskRowContent item={item} />
      </Animated.View>
    </GestureDetector>
  );
}

function FloatingIsland({ item }: { item: TaskItem | null }) {
  if (!item) return null;
  return (
    <Animated.View
      entering={FadeIn.duration(250)}
      exiting={FadeOut.duration(200)}
      layout={LinearTransition.springify().damping(18)}
      style={styles.islandPill}
    >
      <IslandPillContent item={item} />
    </Animated.View>
  );
}

// Parent wires the two together:
export function TaskListWithIsland({ tasks }: { tasks: TaskItem[] }) {
  const [islandItem, setIslandItem] = useState<TaskItem | null>(null);
  return (
    <>
      {tasks.map((item) => (
        <SwipeableRow key={item.id} item={item} onSendToIsland={setIslandItem} />
      ))}
      <FloatingIsland item={islandItem} />
    </>
  );
}
```

The "morph" reads as continuous because the row's `exiting` fade and the
island's `entering` fade overlap in time and both animate toward the same
screen region — the row and island are still two separate mounted
components, not one element sliding across a layout boundary. For a true
cross-component FLIP-style morph, Reanimated's `sharedTransitionTag` prop
does the underlying matching-tag handoff, but it's documented and battle
tested for *screen-to-screen* navigation transitions, not general in-page
morphs — treat it as an experiment, not a guarantee, if you reach for it
here. For a genuinely fluid, blurred morph (the pill "melting" out of the
row), render both in a shared Skia `<Canvas>` and interpolate shape/blur
directly — see the Skia effects recipe below.

**Perf caveat:** keep the island itself simple (text + icon, no nested
Skia/blur) if it can be triggered rapidly (e.g. swiping several rows in
quick succession) — stacking multiple heavy `entering`/`exiting` transitions
back to back is a common source of dropped frames on mid-tier Android
devices.

## Recipe: Gesture interactions (pan / pinch / fling)

Check `motion-design-principles` first — direct-manipulation gestures
(dragging, zooming a photo, flinging a card away) are exactly the
"continuity + gesture feedback" case this skill's taste layer approves by
default; the judgment call is usually about *scope* (one hero element, not
every card in a feed), not whether to animate.

```tsx
import { Gesture, GestureDetector, Directions } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";

function PannablePinchableCard() {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);

  const pan = Gesture.Pan().onChange((e) => {
    translateX.value += e.changeX;
    translateY.value += e.changeY;
  });

  const pinch = Gesture.Pinch()
    .onChange((e) => {
      scale.value = savedScale.value * e.scale;
    })
    .onEnd(() => {
      savedScale.value = scale.value;
    });

  const flingDown = Gesture.Fling()
    .direction(Directions.DOWN)
    .onEnd(() => {
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
      scale.value = withSpring(1);
      savedScale.value = 1;
    });

  // Pan + pinch active together (two-finger drag-zoom); fling-to-reset
  // as a separate, exclusive recognizer.
  const composed = Gesture.Race(Gesture.Simultaneous(pan, pinch), flingDown);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={composed}>
      <Animated.View style={[styles.card, style]} />
    </GestureDetector>
  );
}
```

- Use `onChange`'s `changeX`/`changeY` (already a per-event delta) for pan,
  not manual diffing against `e.translationX` each callback.
- `Gesture.Simultaneous(...)` lets two recognizers run together (pan +
  pinch); `Gesture.Exclusive(...)`/`Gesture.Race(...)` pick one winner when
  gestures would otherwise conflict.

**Perf caveat:** every callback above (`onChange`/`onEnd`) runs as a
worklet on the UI thread already — the mistake to avoid is calling back
into JS (`runOnJS`, `setState`) on every `onChange` frame just to mirror the
value into React state. Only cross to JS on gesture *end*, or when a value
genuinely needs to affect non-Reanimated UI.

## Recipe: Carousel (`react-native-reanimated-carousel`)

Check `motion-design-principles` first — a carousel is usually the "main
content browsing" affordance for a screen, so restraint is less about
whether to animate and more about picking a mode that doesn't fight
scannability (e.g. avoid `horizontal-stack` for a long catalog where users
need to scan many items quickly).

```tsx
import Carousel from "react-native-reanimated-carousel";

// 3D-ish parallax depth — good for a small hero/featured set.
function ParallaxCarousel({ data }: { data: Item[] }) {
  return (
    <Carousel
      width={340}
      height={420}
      data={data}
      mode="parallax"
      modeConfig={{ parallaxScrollingScale: 0.9, parallaxScrollingOffset: 60 }}
      renderItem={({ item }) => <CardContent item={item} />}
    />
  );
}

// Card-stack / tinder-like — good for a "review one at a time" flow.
function StackCarousel({ data }: { data: Item[] }) {
  return (
    <Carousel
      width={320}
      height={420}
      data={data}
      mode="horizontal-stack"
      modeConfig={{
        snapDirection: "left",
        stackInterval: 18,
        scaleInterval: 0.06,
        opacityInterval: 0.3,
      }}
      renderItem={({ item }) => <CardContent item={item} />}
    />
  );
}
```

**Perf caveat:** each carousel item is (by default) rendered eagerly around
the visible window — keep `renderItem` cheap (memoized, no per-frame work
inside it) and load images through `expo-image`, the same rule as any other
list in `mobile-app-agent`.

## Recipe: Skia effects (particles / shaders / blur)

Check `motion-design-principles` first — reserve GPU-canvas effects for
rare, high-value moments (onboarding complete, a purchase confirmation, an
achievement) explicitly called out as "purposeful delight," not as ambient
decoration on a screen the user sees dozens of times a day.

Skia components accept Reanimated shared/derived values directly as props
— no bridging, no re-renders:

```tsx
import { useEffect, useMemo } from "react";
import { Canvas, Circle, Group, BlurMask } from "@shopify/react-native-skia";
import {
  useSharedValue,
  useDerivedValue,
  withTiming,
  Easing,
  type SharedValue,
} from "react-native-reanimated";

const PARTICLE_COUNT = 24;

function Particle({
  progress,
  angle,
  distance,
}: {
  progress: SharedValue<number>;
  angle: number;
  distance: number;
}) {
  const cx = useDerivedValue(() => 100 + Math.cos(angle) * distance * progress.value);
  const cy = useDerivedValue(() => 100 + Math.sin(angle) * distance * progress.value);
  const r = useDerivedValue(() => 6 * (1 - progress.value));
  return (
    <Circle cx={cx} cy={cy} r={r} color="#7c5cff">
      <BlurMask blur={4} style="normal" />
    </Circle>
  );
}

export function ParticleBurst({ trigger }: { trigger: number }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);

  const particles = useMemo(
    () =>
      Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
        angle: (i / PARTICLE_COUNT) * Math.PI * 2,
        distance: 60 + (i % 5) * 12,
      })),
    [],
  );

  return (
    <Canvas style={{ width: 200, height: 200 }}>
      <Group>
        {particles.map((p, i) => (
          <Particle key={i} progress={progress} angle={p.angle} distance={p.distance} />
        ))}
      </Group>
    </Canvas>
  );
}
```

A simple animated SkSL shader background, for a rarer "premium" moment:

```tsx
import { Canvas, Fill, Shader, Skia } from "@shopify/react-native-skia";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";

// Create the runtime effect once, at module scope — not per render.
const source = Skia.RuntimeEffect.Make(`
  uniform float2 resolution;
  uniform float time;
  half4 main(float2 xy) {
    float2 uv = xy / resolution;
    float wave = sin(uv.x * 10.0 + time) * 0.5 + 0.5;
    return half4(wave, uv.y, 1.0 - wave, 1.0);
  }
`);

export function ShaderBackground({ time }: { time: SharedValue<number> }) {
  const uniforms = useDerivedValue(() => ({ resolution: [300, 300], time: time.value }));
  if (!source) return null; // null if the SkSL failed to compile — fail closed, not crash
  return (
    <Canvas style={{ width: 300, height: 300 }}>
      <Fill>
        <Shader source={source} uniforms={uniforms} />
      </Fill>
    </Canvas>
  );
}
```

**Perf caveat:** each `<Canvas>` is its own GPU compositor layer — don't
mount several full-screen Skia canvases at once, and cap concurrent
particle/shader effects to one "hero" effect per screen. For particle
counts beyond a few dozen, per-node `<Circle>` components stop scaling;
switch to Skia's `Atlas`/`Points` APIs, which draw many instances in a
single GPU draw call. `Skia.RuntimeEffect.Make` returns `null` on a shader
compile error — always guard for it rather than asserting non-null.

## Do

- Check `motion-design-principles` before adding any recipe here — this
  file assumes the "should we animate" call was already made.
- Keep `newArchEnabled: true` and `react-native-worklets` installed before
  touching any recipe in this file.
- Branch on `useReducedMotion()` for every non-trivial animation.
- Keep shared-value mutation and derived-value math inside worklets
  (`useAnimatedStyle`, `useDerivedValue`, gesture callbacks) — never mirror
  a per-frame value into React state.
- Cap concurrent heavy effects (multiple Skia canvases, several
  simultaneous layout-transition morphs) to what a mid-tier device can
  actually composite at 60fps.
- Read the vendored `react-native-best-practices` skill for anything this
  recipe library doesn't cover.

## Don't

- Don't add a scroll-driven 3D card effect to a `FlashList`-virtualized
  long feed expecting the shared-`scrollY` pattern to survive recycling.
- Don't call `runOnJS`/`setState` on every gesture `onChange` frame — only
  at gesture end, or when a value must reach non-Reanimated UI.
- Don't stack multiple heavy `entering`/`exiting` transitions or Skia
  effects on the same trigger without a perf pass on a real low-end device.
- Don't reach for a 3D engine (`@react-three/fiber`, `filament`) for depth —
  perspective transforms and Skia cover this template's default scope.
- Don't skip the `useReducedMotion()` branch "because it's a small
  animation" — Reduce Motion is an accessibility setting, not a suggestion.
