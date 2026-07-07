---
name: shared-contracts
description: Use when adding or changing a zod schema in packages/shared that both apps/mobile and apps/api must agree on — a request/response contract, a shared enum, or the @shared/* import path itself. This is the single source of truth both nestjs-backend's createZodDto DTOs and mobile-api-integration's typed client validate against.
---

# shared-contracts

`packages/shared` is where a data shape gets defined exactly once and
consumed by both `apps/api` (via `nestjs-zod`'s `createZodDto`) and
`apps/mobile` (via the typed API client + TanStack Query). It has zero
dependencies on either app — schemas and inferred types only.

## Goal

One zod schema per shape, one inferred TypeScript type from that schema
(never a hand-written parallel `interface`), imported by both sides through
the `@shared/*` path alias. A backend contract change and a mobile client
drifting apart becomes a compile-time/parse-time failure, not a runtime bug
discovered in production.

## Layout

```
packages/shared/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts              # re-exports everything below
    └── contracts/
        ├── pagination.ts     # cursor pagination query + envelope helper
        ├── error.ts          # the error envelope (api-design)
        ├── auth.ts           # login/register request+response shapes
        └── post.ts           # example resource contract, below
```

## `package.json` — exports map

```json
{
  "name": "@shared/contracts",
  "version": "0.0.0",
  "private": true,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
    "./contracts/*": {
      "types": "./dist/contracts/*.d.ts",
      "default": "./dist/contracts/*.js"
    }
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "typescript": "^5.6.0"
  }
}
```

Both consuming apps declare the workspace dependency explicitly:

```json
// apps/api/package.json and apps/mobile/package.json (excerpt)
"dependencies": {
  "@shared/contracts": "workspace:*"
}
```

`pnpm-workspace.yaml` is what makes `workspace:*` resolve to a symlink into
each app's `node_modules` rather than trying to fetch `@shared/contracts`
from a registry.

## The `@shared/*` alias — two resolution paths, kept in sync

`tsconfig.base.json` maps `@shared/*` straight to **source**, so `tsc`
(and any editor) gets instant type information without needing
`packages/shared` built first:

```json
// tsconfig.base.json (already in the repo root — do not duplicate this in app tsconfigs)
{ "compilerOptions": { "paths": { "@shared/*": ["packages/shared/src/*"] } } }
```

That `paths` mapping is a **type-checking convenience only** — it doesn't
affect what Metro (mobile bundler), `ts-node`/SWC (Nest dev server), or Jest
actually resolve at runtime. Runtime resolution goes through the real
`@shared/contracts` package installed via the pnpm workspace, whose
`exports` map (above) points at `./dist/*`. Concretely, this means:

- Run `pnpm --filter @shared/contracts build` (or keep a watch script
  running) before `apps/api`/`apps/mobile` can actually **run** against a
  changed schema — `tsc --noEmit` typechecking against source works
  immediately, but Metro/Node resolving the installed package does not until
  `dist/` is rebuilt.
- Both apps must list `"@shared/contracts": "workspace:*"` in their own
  `package.json` — the root `tsconfig.base.json` alias alone does not make
  pnpm symlink the package into an app's `node_modules`.

## Example contract — schema, inferred type, both consumers

```ts
// packages/shared/src/contracts/post.ts
import { z } from "zod";

export const postSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200),
  body: z.string().min(1),
  authorId: z.string().uuid(),
  createdAt: z.string().datetime(),
});
export type Post = z.infer<typeof postSchema>;

export const createPostRequestSchema = postSchema.pick({ title: true, body: true });
export type CreatePostRequest = z.infer<typeof createPostRequestSchema>;
```

**`apps/api` side** — `nestjs-zod`'s `createZodDto` wraps the schema
directly, so the DTO Nest validates against and the schema mobile validates
against are the literal same object, not two hand-synced copies (see
`nestjs-backend`):

```ts
// apps/api/src/modules/posts/dto/create-post.dto.ts
import { createZodDto } from "nestjs-zod";
import { createPostRequestSchema } from "@shared/contracts/post";

export class CreatePostDto extends createZodDto(createPostRequestSchema) {}
```

**`apps/mobile` side** — the typed API client validates the response
against the same schema before a screen ever sees the data (see
`mobile-api-integration`):

```ts
// apps/mobile/src/api/hooks/use-post.ts
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { postSchema } from "@shared/contracts/post";

export function usePost(id: string) {
  return useQuery({
    queryKey: ["post", id],
    queryFn: () => apiClient.get(`/posts/${id}`, postSchema),
  });
}
```

If `apps/api` renames `body` to `content`, both `createZodDto` (the request
DTO) and `postSchema` (the response the mobile client parses) change in the
same file edit — there is no second copy of the shape anywhere to forget to
update.

## Do

- Define every request/response shape once, in `packages/shared/src/contracts/`,
  and import it from both `apps/api` and `apps/mobile` — never redeclare it
  on either side.
- Derive request/subset schemas from the canonical schema with `.pick()`/
  `.extend()`/`.omit()` (as `createPostRequestSchema` does above) rather than
  writing a second, independently-maintained schema.
- Infer types with `z.infer<typeof schema>` — never hand-write a parallel
  `interface`/`type` for something a schema already describes.
- Rebuild `packages/shared` (or run its watch script) after changing a
  schema, before expecting the change to show up when running the mobile or
  API app — the `@shared/*` tsconfig path is source-only, runtime resolution
  is the built package.

## Don't

- Don't import anything from `apps/api/src/*` or `apps/mobile/src/*` into
  `packages/shared` — the dependency direction is one-way; shared has zero
  app dependencies.
- Don't put non-serializable values in a contract — no functions, class
  instances, or React components. This package describes data shapes, not
  shared business logic or UI.
- Don't hand-write a DTO class with `class-validator` decorators that
  duplicates a `packages/shared` schema — always go through `createZodDto`.
- Don't assume editing `packages/shared/src/*` alone is enough for the
  running apps to see the change — the workspace package resolves through
  `dist/`, which needs a build.
