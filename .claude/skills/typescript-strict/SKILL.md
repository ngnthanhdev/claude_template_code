---
name: typescript-strict
description: Use when writing TypeScript anywhere in this monorepo and tempted to reach for `any`, a type assertion, or a loosely-typed union — narrowing, discriminated unions, `satisfies`, and inference patterns that keep tsconfig.base.json's strict flags actually enforced rather than quietly worked around.
---

# typescript-strict

The "no `any`" rule from `CLAUDE.md`'s coding rules, expanded into the
patterns that make it practical: narrowing over assertion, discriminated
unions over ad-hoc optional fields, `satisfies` over `as`, and letting zod
schemas infer types instead of hand-writing parallel ones.

## Goal

`tsc --noEmit` (Turborepo's `typecheck` task) is the actual gate, not a
suggestion — a task isn't done if it only compiles because an `any` or an
unchecked assertion is hiding a real type error from the compiler.

## Why these specific `tsconfig.base.json` flags

```json
{
  "strict": true,
  "noUncheckedIndexedAccess": true,
  "noImplicitOverride": true,
  "esModuleInterop": true,
  "skipLibCheck": true
}
```

| Flag | Why it's on |
|---|---|
| `strict` | The baseline bundle (`noImplicitAny`, `strictNullChecks`, `strictFunctionTypes`, `strictPropertyInitialization`, etc.) — without it, `any` and `null`/`undefined` sneak past the compiler everywhere. |
| `noUncheckedIndexedAccess` | `arr[i]` and `record[key]` are typed `T \| undefined`, not `T`, forcing a check before use. This catches the single most common runtime crash in both a Nest service (`array[0].id` on an empty result) and a mobile screen (`items[index]` past the end of a list). |
| `noImplicitOverride` | A subclass method must be marked `override` to override a base method — catches a typo that silently creates a *new*, unused method instead of overriding one (easy to do when extending Passport's `AuthGuard` or a Prisma-wrapped service). |
| `esModuleInterop` | Consistent default-import interop between CJS packages (several RN/Nest dependencies still ship CJS) and this codebase's ESM-style imports. |
| `skipLibCheck` | Skips type-checking `.d.ts` files inside `node_modules` — a large speed win in a monorepo this size, and a third-party package's internal type errors aren't something this codebase can fix anyway. |

## No `any` — narrow `unknown` instead

```ts
// Bad — no safety at all; a typo or shape change fails silently at runtime.
function handle(payload: any) {
  return payload.user.name;
}

// Good — unknown forces a real check before use; zod both validates and narrows.
function handle(payload: unknown) {
  const parsed = eventSchema.safeParse(payload);
  if (!parsed.success) throw new Error("invalid payload");
  return parsed.data.user.name; // now fully typed, from the schema in @shared
}
```

`unknown` is the honest type for "I don't know this shape yet" — it forces
narrowing before any property access compiles, where `any` just turns the
compiler off for that value (and silently for everything it touches
afterward).

## Discriminated unions over optional-field soup

```ts
// Bad — every field is optional, nothing stops an invalid combination
// (e.g. status "success" with no data) from compiling.
interface QueryState<T> {
  status: "loading" | "error" | "success";
  data?: T;
  error?: Error;
}

// Good — each variant carries exactly the fields valid for that state.
type QueryState<T> =
  | { status: "loading" }
  | { status: "error"; error: Error }
  | { status: "success"; data: T };

function render<T>(state: QueryState<T>) {
  switch (state.status) {
    case "loading":
      return "Loading…";
    case "error":
      return state.error.message; // narrowed to the error branch — .error exists here
    case "success":
      return state.data; // narrowed to the success branch — .data exists here
  }
}
```

A `switch` over the discriminant narrows each branch automatically; TS also
flags a missing branch if the union grows a new variant later (with
`noImplicitReturns`/a trailing `never` check), which optional-field soup
can't give you.

## `satisfies` over `as`

```ts
type Role = "admin" | "member";

// Bad — `as` silences the compiler; a typo'd key or missing key is hidden.
const roleLabels = { admin: "Administrator", memeber: "Member" } as Record<Role, string>;

// Good — satisfies checks the object against the shape AND keeps the
// literal types (roleLabels.admin is "Administrator", not widened to `string`).
const roleLabels = {
  admin: "Administrator",
  member: "Member",
} satisfies Record<Role, string>;
```

`as` is a one-way assertion — "trust me" — that catches nothing. `satisfies`
verifies the value actually matches the target shape (missing/misspelled
keys are a compile error) while preserving the more specific inferred type
for downstream use.

## Let inference — and zod — do the work

```ts
// Redundant — two sources of truth for the same shape, which can drift.
interface Post {
  id: string;
  title: string;
}
const postSchema: z.ZodType<Post> = z.object({ id: z.string(), title: z.string() });

// Preferred — one source of truth; see shared-contracts.
const postSchema = z.object({ id: z.string(), title: z.string() });
type Post = z.infer<typeof postSchema>;
```

Don't annotate a variable's type when TS can already infer it correctly
from its initializer — a redundant annotation is one more place a future
edit can make the declared type and the actual value disagree without the
compiler noticing (annotating `const post: Post = ...` doesn't add safety
over inference; it adds a second thing that can go stale).

## `noUncheckedIndexedAccess` in practice

```ts
const items: Item[] = [];
const first = items[0]; // typed `Item | undefined`, not `Item`
if (!first) return null;
// `first` is narrowed to `Item` from here on
console.log(first.name);
```

Don't reach for a non-null assertion (`items[0]!`) to silence this — that's
exactly the runtime crash the flag exists to catch. Check for `undefined`
(as above), or use `.at(-1)`/`.find()` and handle the `undefined` case, or
prove the index is safe via a length check the compiler can see.

## Do

- Type unknown external input `unknown`, then narrow it with a zod
  `safeParse` (or an explicit type guard) before touching any property.
- Model "one of several exclusive states" as a discriminated union with a
  literal tag field, switched over.
- Use `satisfies` when you want a literal-preserving check against a shape;
  reach for it before `as`.
- Let zod schemas be the type source (`z.infer<>`) instead of hand-writing a
  parallel interface.
- Handle the `undefined` case `noUncheckedIndexedAccess` forces on every
  index/lookup, rather than asserting it away.

## Don't

- Don't use `any` — not even temporarily "to get it compiling"; use
  `unknown` and narrow.
- Don't use a type assertion (`as X`) to silence a real type mismatch —
  fix the mismatch, or use `satisfies` if the goal is just to check a
  literal against a shape.
- Don't add a non-null assertion (`!`) to work around
  `noUncheckedIndexedAccess` — that reintroduces exactly the crash the flag
  is there to prevent.
- Don't hand-write a TS `interface`/`type` for a shape that's already a zod
  schema somewhere in `packages/shared` — infer it instead.
