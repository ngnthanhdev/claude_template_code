---
name: database-orm
description: Use when defining or evolving the apps/api Prisma schema, running a migration, modeling a relation, building the PrismaModule/PrismaService, optimizing a query, or wrapping multiple writes in a transaction. Pairs with nestjs-backend for how a service consuming PrismaService fits into a module, and backend-testing for mocking PrismaService in unit tests.
---

# database-orm

`apps/api`'s data layer: Prisma schema + migrations, a `PrismaModule`/
`PrismaService` every feature module injects, query-optimization habits, and
the two `$transaction` forms.

## Goal

One `schema.prisma` as the single source of truth for the database shape,
one `PrismaService` every module shares (never a `new PrismaClient()` per
module), migrations applied through `prisma migrate` rather than hand-edited
SQL, and multi-write operations wrapped in a transaction rather than left to
"probably won't fail between these two calls."

## Schema

```prisma
// apps/api/prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(uuid())
  email     String   @unique
  name      String
  posts     Post[]
  createdAt DateTime @default(now())
}

model Post {
  id        String   @id @default(uuid())
  title     String
  body      String
  published Boolean  @default(false)
  author    User     @relation(fields: [authorId], references: [id])
  authorId  String
  createdAt DateTime @default(now())

  @@index([authorId, createdAt])
}
```

- `Post.author`/`authorId` is Prisma's standard relation shape: the scalar
  foreign key (`authorId`) plus the relation field (`author`) that resolves
  it — query the scalar for filters/joins, the relation field only when you
  actually need the related row.
- `@@index([authorId, createdAt])` matches the exact filter+sort this
  template's cursor pagination uses (`api-design`) — an index that doesn't
  match your actual query pattern doesn't help; add indexes for the queries
  you write, not defensively for every column.

## Migrations

```bash
# Local dev — creates + applies a migration, regenerates the client
pnpm --filter api exec prisma migrate dev --name add_post_model

# CI / production — applies committed migrations, never creates new ones
pnpm --filter api exec prisma migrate deploy

# After pulling someone else's migration, or after editing schema.prisma
# without changing the DB shape yet (e.g. adding a generator option):
pnpm --filter api exec prisma generate
```

- `migrate dev` is a local/dev-only command — it can prompt to reset the
  database on drift. `migrate deploy` is the only migration command that
  runs in CI or production; it never generates new migrations, only applies
  ones already committed to `apps/api/prisma/migrations/`.
- Commit the generated `migrations/` folder — it's the audit trail of every
  schema change and what `migrate deploy` replays in every other
  environment.

## `PrismaModule` / `PrismaService`

```ts
// apps/api/src/prisma/prisma.service.ts
import { Injectable, INestApplication, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }

  async enableShutdownHooks(app: INestApplication) {
    process.on("beforeExit", async () => {
      await app.close();
    });
  }
}
```

```ts
// apps/api/src/prisma/prisma.module.ts
import { Global, Module } from "@nestjs/common";
import { PrismaService } from "./prisma.service";

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

`@Global()` means every feature module can inject `PrismaService` without
importing `PrismaModule` itself — worth the (small) loss of explicit
per-module dependency listing, since literally every resource module needs
the same one DB client.

```ts
// apps/api/src/modules/posts/posts.service.ts
import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type { PaginationQuery } from "@shared/contracts/pagination";

@Injectable()
export class PostsService {
  constructor(private readonly prisma: PrismaService) {}

  async findPage({ cursor, limit }: PaginationQuery) {
    const rows = await this.prisma.post.findMany({
      take: limit + 1, // fetch one extra row to know if there's a next page
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: "desc" },
    });
    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    const last = data.at(-1);
    return { data, meta: { nextCursor: hasMore && last ? last.id : null, limit } };
  }

  async findOneOrThrow(id: string) {
    const post = await this.prisma.post.findUnique({ where: { id } });
    if (!post) throw new NotFoundException(`Post ${id} not found`);
    return post;
  }

  create(input: { title: string; body: string; authorId: string }) {
    return this.prisma.post.create({ data: input });
  }
}
```

`findPage` fulfills `api-design`'s cursor-pagination contract exactly:
`take: limit + 1` + `cursor`/`skip: 1` is the standard Prisma cursor-pagination
recipe (skip the cursor row itself, take one extra to detect `hasMore`
without a separate `count()` query).

## Query optimization

- **`select`/`include` only what the response schema needs.** Don't
  `findMany()` a whole row (all columns) when the endpoint's zod schema
  (`shared-contracts`) only exposes three of them — over-fetching wastes
  DB→app bandwidth and risks leaking a column (e.g. a password hash) that
  should never reach the response.
- **Avoid N+1 with `include`, not a loop.** Fetching posts and then calling
  `findUnique` for each post's author inside a loop is N+1 queries; a single
  `findMany({ include: { author: true } })` is one query with a join.
- **Index for the query you actually run**, matching filter + sort columns
  in one composite index (as above) — a single-column index on `authorId`
  alone still forces a separate sort step for `orderBy: createdAt`.
- **Cursor pagination over `skip`/offset** for anything that can grow large —
  `skip: 10000` still has the database walk past 10,000 rows before it can
  return the 10,001st; a cursor (`WHERE id > :cursor`) doesn't.

## Transactions — `$transaction`

**Sequential array form** — independent writes that must all succeed or all
roll back, none depending on another's result:

```ts
await prisma.$transaction([
  prisma.post.update({ where: { id: postId }, data: { published: true } }),
  prisma.user.update({ where: { id: authorId }, data: { postCount: { increment: 1 } } }),
]);
```

**Interactive form** — when a later write needs to read a result from an
earlier one first (e.g. checking a balance before decrementing it):

```ts
await prisma.$transaction(async (tx) => {
  const wallet = await tx.wallet.findUniqueOrThrow({ where: { userId } });
  if (wallet.balance < amount) {
    throw new Error("Insufficient balance"); // throwing inside rolls back everything above
  }
  await tx.wallet.update({ where: { userId }, data: { balance: { decrement: amount } } });
  await tx.ledgerEntry.create({ data: { userId, amount: -amount } });
});
```

Use the array form when you can (Prisma can optimize/batch it); reach for
the interactive callback form only when a write genuinely depends on a read
that must happen inside the same transaction, since it holds a DB connection
open for the whole callback.

## Do

- Change the DB shape only through `schema.prisma` + `prisma migrate dev`,
  never a hand-written `ALTER TABLE`.
- Inject the shared `PrismaService`, never instantiate a second
  `PrismaClient`.
- Add composite indexes matching your actual filter+sort, not one index per
  column defensively.
- Wrap multi-row writes that must succeed/fail together in `$transaction`.

## Don't

- Don't run `prisma migrate dev` in CI or production — that's
  `migrate deploy`'s job.
- Don't loop-and-query for related rows — use `include`/`select` to fetch a
  relation in the same query.
- Don't use `skip`/offset pagination for a table that can grow past a page
  or two — use the cursor pattern above.
- Don't leave a multi-step write un-transacted just because "it usually
  works" — a partial failure between two related writes is a real, if rare,
  data-corruption bug.
