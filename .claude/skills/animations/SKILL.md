---
name: animations
description: Animation for apps/mobile in two layers — the taste layer (when and how much to animate, Reduce Motion, durations/springs) and the Reanimated v4 recipe library (scroll-driven 3D cards, swipe-to-island morph, gestures, carousel, Skia effects). ALWAYS apply the principles first; read the recipes only when actually implementing an approved animation.
---

# Animations

Two layers, in strict order:

1. **Principles (the taste layer) — always first:** `references/principles.md`
   decides *whether and how much* to animate. Core rules: animation must
   communicate state, direction, or causality — never decoration (Article X);
   honor `useReducedMotion()`; 200–350ms durations or springs; UI-thread-only
   work (worklets), never block the JS thread.
2. **Recipes (the how) — only once an animation is justified:**
   `references/recipes.md` is the Reanimated v4 recipe library
   (scroll-driven 3D cards, swipe-to-island morph, gesture interactions,
   carousels, Skia effects) plus setup gotchas.

Reanimated 4 requires the New Architecture (`newArchEnabled: true`) and
worklets live in the separate `react-native-worklets` package — wiring
lives in the `expo-router-nativewind` foundation skill. For authoritative
upstream guidance also see the vendored `react-native-best-practices`.
