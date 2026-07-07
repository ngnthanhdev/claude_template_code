---
name: mobile-testing-release
description: Use when writing unit/component tests for apps/mobile (Jest + React Testing Library), authoring Maestro e2e flows, or preparing an EAS release (the pre-submission checklist). Load expo-eas-pipeline for the build/submit profiles themselves.
---

# mobile-testing-release

Testing strategy for `apps/mobile` across the three levels this template
uses (see `docs/CI_CD.md` / the design spec's testing table), plus the
checklist to run before cutting an EAS release.

## Goal

Unit/component tests run after every task (`task-implementer`'s TDD loop);
Maestro e2e flows cover the critical happy paths before a release; nothing
ships to EAS production without the release checklist below passing.

## Unit / component tests — Jest + React Testing Library

```bash
pnpm --filter mobile add -D jest jest-expo @testing-library/react-native @testing-library/jest-native
```

```js
// jest.config.js
module.exports = {
  preset: "jest-expo",
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|native-base|react-native-svg)/)",
  ],
  setupFilesAfterEnv: ["@testing-library/jest-native/extend-expect"],
};
```

Component test example — testing behavior, not implementation:

```tsx
// src/components/post/__tests__/create-post-form.test.tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import { CreatePostForm } from "../create-post-form";

jest.mock("@/api/hooks/use-create-post", () => ({
  useCreatePost: () => ({ mutate: mockMutate, isPending: false, error: null }),
}));

test("shows a validation error and does not submit when title is empty", async () => {
  const onDone = jest.fn();
  render(<CreatePostForm onDone={onDone} />);

  fireEvent.press(screen.getByText("Post"));

  await waitFor(() => {
    expect(screen.getByText(/title is required/i)).toBeOnTheScreen();
  });
  expect(mockMutate).not.toHaveBeenCalled();
});
```

- Query by what the user sees (`getByText`, `getByRole`, `getByLabelText`),
  never by internal component structure or test IDs unless there's no
  accessible query available.
- Mock the API/query hook layer (`mobile-api-integration`'s hooks), not
  `fetch` directly — a component test shouldn't need to know about the HTTP
  layer underneath.
- Test business-relevant behavior (validation, empty states, error states,
  loading states), not implementation details (whether a specific internal
  function was called).
- Unit-test pure logic (formatters, validators not already covered by the
  zod schema itself, selectors) with plain Jest, no rendering needed.

## Integration — React Testing Library, layer-end

At the end of a layer, `test-writer` adds broader flows a single-task unit
test wouldn't catch: a screen composed of several components + a real (not
mocked) `QueryClientProvider` backed by a mock server (e.g. `msw`), covering
a full user flow within one screen (fill form → submit → see the created
item appear in the list).

## E2E — Maestro

Maestro drives the *installed app* through real user flows across an entire
navigation path — sign-in → create → view — closer to what a user actually
does than any RTL test can simulate.

```bash
brew tap mobile-dev-inc/tap && brew install maestro
```

```yaml
# .maestro/sign-in-and-post.yaml
appId: com.example.mobile
---
- launchApp
- tapOn: "Sign in"
- tapOn:
    id: "email-input"
- inputText: "test@example.com"
- tapOn:
    id: "password-input"
- inputText: "correct-horse-battery-staple"
- tapOn: "Sign in"
- assertVisible: "Home"
- tapOn: "New post"
- tapOn:
    id: "title-input"
- inputText: "My first post"
- tapOn: "Post"
- assertVisible: "My first post"
```

```bash
maestro test .maestro/sign-in-and-post.yaml
```

- Write one Maestro flow per critical happy path (auth, the core
  create/view loop, any payment/irreversible action) — not exhaustive
  coverage of every screen; that's what unit/component tests are for.
- Give interactive elements stable `testID`s (`id: "email-input"` above maps
  to a component's `testID="email-input"`) rather than relying on visible
  text that copy/i18n changes could break.
- Run Maestro flows against a build close to production shape (EAS
  `development`/`preview` profile, not the Metro dev server) so the flow
  reflects what actually ships.
- Maestro flows are the right place to catch RTL layout regressions
  (`mobile-i18n-theme`) and auth-gate regressions (`mobile-auth-state`) —
  both span more than one screen/component.

## EAS release checklist

Before triggering a `production` EAS build/submit (see
`expo-eas-pipeline`), confirm:

- [ ] `pnpm turbo run lint typecheck test` is green (CI's `quality` job, or
      run locally before pushing — this repo's hook blocks running the
      *build* itself in-session, not lint/typecheck/test).
- [ ] All Maestro critical-path flows pass against a `preview`-profile
      build.
- [ ] `app.json` version/build number bumped per the platform's store
      requirements (or `appVersionSource: "remote"` + EAS autoIncrement is
      configured and trusted — see `expo-eas-pipeline`).
- [ ] No `console.log`/debug flags left enabled for the production
      environment variable set.
- [ ] Required secrets exist in the EAS project's `production` environment
      (`EXPO_PUBLIC_API_URL` pointing at the real API, any third-party keys)
      — see `expo-eas-pipeline`'s EAS env section.
- [ ] Push notification / deep link entitlements (if used) are configured
      for the production bundle identifier, not just development.

Don't skip a checklist item because "it worked in preview" — preview and
production EAS profiles can differ in bundle identifier, entitlements, and
environment variables (see `expo-eas-pipeline`); each has bitten real
releases when assumed identical.

## Do

- Query RTL tests by accessible role/text, not test IDs, unless nothing
  accessible is available.
- Mock at the API-hook boundary, not the HTTP layer.
- Keep Maestro flows scoped to critical, cross-screen happy paths.
- Run the full EAS checklist before every production release, not just the
  first one.

## Don't

- Don't test internal implementation details (which function got called)
  over observable behavior.
- Don't write a Maestro flow for every screen — that duplicates
  component-test coverage at much higher runtime cost.
- Don't assume a preview build's behavior guarantees production build
  behavior — profiles can differ meaningfully.
- Don't run `eas build` (or `expo run:*`, `gradlew`, `pod install`,
  `xcodebuild`) from inside a Claude Code session — `block-build-output.sh`
  denies these automatically; run them in a real terminal and paste back
  only the error. `maestro test` itself isn't hook-blocked, but it still
  needs a built app and a connected simulator/device, so prefer running it
  from a real terminal too rather than burning session time waiting on it.
