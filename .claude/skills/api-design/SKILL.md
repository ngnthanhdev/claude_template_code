---
name: api-design
description: Use when designing or reviewing a REST endpoint in apps/api — resource naming/URL shape, versioning, pagination, the error response envelope, or which HTTP status code to return. Load before nestjs-backend (which wires the endpoint you design here) and alongside shared-contracts (the zod schemas that encode the shapes this skill designs).
---

# api-design

The resource-design conventions every `apps/api` endpoint follows, so a
`task-implementer` never has to invent pagination or error shape ad hoc per
endpoint. This skill decides **what the wire format looks like**;
`nestjs-backend` decides **how Nest produces it**.

## Goal

Every endpoint in this template is boring in the same way: nouns not verbs,
one consistent success envelope for collections, one consistent error
envelope for failures, cursor pagination instead of offset, and a status
code chosen from a fixed, small table — never invented per endpoint.

## Resource naming and URL shape

- **Nouns, plural, lowercase-kebab:** `/posts`, `/posts/:id`, `/posts/:id/comments`.
  Never a verb in the path (`/getPosts`, `/createPost`) — the HTTP method is
  the verb.
- **Nest at most one level deep.** `/posts/:postId/comments` is fine;
  `/users/:userId/posts/:postId/comments/:commentId/replies` is not — surface
  `replies` as its own top-level resource (`/comments/:commentId/replies` or
  a query filter) once nesting would need three or more path params to
  identify a row.
- **Actions that aren't CRUD** get a sub-resource verb noun, not a verb on
  the collection: `POST /posts/:id/publish`, not `POST /posts/:id?action=publish`.

## Versioning

URI versioning, enabled once in `main.ts` (see `nestjs-backend`), so every
route is implicitly `/v1/...` without repeating `v1` in every controller:

```ts
// apps/api/src/main.ts (excerpt — full bootstrap lives in nestjs-backend)
app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });
```

```ts
@Controller("posts") // resolves to /v1/posts
export class PostsController {}
```

- Bump to `/v2/...` only for a **breaking** change to a resource's shape
  (removed/renamed field, changed semantics) — additive fields never need a
  new version, since every consumer validates the response through a zod
  schema that simply ignores unknown extra fields.
- Never version by request header or query param in this template — URI
  versioning is visible in logs, curl-able, and cacheable without special
  handling.

## Request/response shape

- A **single resource** returns the object directly — no wrapper:
  `GET /v1/posts/:id` → `{ id, title, body, authorId, createdAt, ... }`.
- A **collection** is always wrapped in a `data`/`meta` envelope, never a
  bare array (a bare array can't grow a `meta` field later without breaking
  every existing consumer):

```ts
// packages/shared/src/contracts/pagination.ts
import { z } from "zod";

export const paginationQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export function paginatedResponseSchema<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    data: z.array(item),
    meta: z.object({
      nextCursor: z.string().uuid().nullable(),
      limit: z.number(),
    }),
  });
}
```

```ts
// packages/shared/src/contracts/post.ts
import { z } from "zod";
import { paginatedResponseSchema } from "./pagination";

export const postSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200),
  body: z.string().min(1),
  authorId: z.string().uuid(),
  createdAt: z.string().datetime(),
});

export const postListResponseSchema = paginatedResponseSchema(postSchema);
```

- **Cursor pagination, not offset.** `cursor` is the last-seen row's `id`;
  `nextCursor: null` means the caller reached the end. Offset pagination
  (`?page=3`) shifts under concurrent writes (a new row pushes everything
  else back a page) — cursor pagination doesn't have that failure mode. See
  `database-orm` for the Prisma query that fulfills this contract.

## Error envelope

Every failure — validation, not-found, auth, unexpected — comes back as the
same shape, never a bare string or a framework-default HTML error page:

```ts
// packages/shared/src/contracts/error.ts
import { z } from "zod";

export const errorEnvelopeSchema = z.object({
  error: z.object({
    code: z.string(), // stable, machine-matchable: "VALIDATION_ERROR", "NOT_FOUND"
    message: z.string(), // human-readable, safe to show in a toast
    details: z.record(z.string(), z.unknown()).optional(), // e.g. field-level validation errors
  }),
});
export type ErrorEnvelope = z.infer<typeof errorEnvelopeSchema>;
```

`code` is what client code branches on (`if (error.code === "NOT_FOUND")`);
`message` is what gets shown to a user; never make the client parse
`message` to decide behavior — that's what `code` is for. `nestjs-backend`'s
global exception filter is the single place that produces this shape, so no
controller ever hand-writes an error response.

## HTTP status conventions

| Status | Use it for |
|---|---|
| `200 OK` | Successful `GET`/`PATCH`/`PUT`, or a `POST` that doesn't create a resource (e.g. `POST /posts/:id/publish`) |
| `201 Created` | Successful `POST` that creates a resource — include the created resource in the body |
| `204 No Content` | Successful `DELETE`, or any action with nothing useful to return |
| `400 Bad Request` | Malformed request the schema can't even parse into shape (rare — `422` covers most cases nestjs-zod raises) |
| `401 Unauthorized` | Missing/invalid/expired credentials — see `backend-auth-security` |
| `403 Forbidden` | Valid credentials, insufficient permission (RBAC) — see `backend-auth-security` |
| `404 Not Found` | Resource doesn't exist, or exists but the caller shouldn't know that (avoid leaking existence via `403` vs `404` inconsistently) |
| `409 Conflict` | Request conflicts with current state (duplicate unique field, optimistic-lock version mismatch) |
| `422 Unprocessable Entity` | Well-formed request, fails schema validation (nestjs-zod's default for a failed `ZodValidationPipe`) |
| `429 Too Many Requests` | Rate limit exceeded |
| `500 Internal Server Error` | Unhandled/unexpected — the exception filter's catch-all; never let a stack trace reach the client body in production |

## Do

- Design the resource shape as a `packages/shared` zod schema first, before
  writing the Nest controller — the schema *is* the contract review.
- Wrap every collection response in `{ data, meta }`; return a single
  resource bare.
- Use cursor pagination for anything that can grow past one page.
- Pick the status code from the table above — don't invent a new meaning
  for an existing code (e.g. `200` with an error body).

## Don't

- Don't put a verb in a URL path — the HTTP method is the verb.
- Don't nest resources more than one level deep.
- Don't version by header or query param — URI versioning only.
- Don't return a bare array for a collection, ever — it can't evolve.
- Don't let an endpoint hand-roll its own error shape — that's
  `nestjs-backend`'s global exception filter's job, applied once, globally.
