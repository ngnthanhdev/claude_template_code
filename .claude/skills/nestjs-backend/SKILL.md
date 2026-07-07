---
name: nestjs-backend
description: Use when building or wiring apps/api — Nest modules/controllers/providers, dependency injection, guards/interceptors/pipes, DTOs, the Fastify adapter bootstrap, the nestjs-zod global validation pipe, ConfigModule, or the global exception filter. Load api-design first for the endpoint shape being wired, and shared-contracts for the zod schemas the DTOs wrap.
---

# nestjs-backend

The canonical shape of `apps/api`: Nest on the **Fastify** adapter (not
Express), request validation via **`nestjs-zod`** against `packages/shared`
schemas, one global exception filter producing `api-design`'s error
envelope, and a feature-module-per-resource layout.

## Goal

One bootstrap, one validation pipe, one exception filter, applied globally —
so no controller reinvents validation or error shaping, and every feature
module looks the same (`module` + `controller` + `service` + `dto/`).

## Bootstrap — Fastify adapter

```bash
pnpm --filter api add @nestjs/platform-fastify nestjs-zod
```

```ts
// apps/api/src/main.ts
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { VersioningType } from "@nestjs/common";
import { ZodValidationPipe } from "nestjs-zod";
import helmet from "@fastify/helmet";
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: true }),
  );

  app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });
  app.useGlobalPipes(new ZodValidationPipe());
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(",") ?? false,
    credentials: true,
  });
  await app.register(helmet); // see backend-auth-security for CSP/config details

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, "0.0.0.0");
}
bootstrap();
```

- `NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter())`
  is the one line that determines everything downstream is Fastify, not
  Express — request/response objects in raw handlers are `FastifyRequest`/
  `FastifyReply`, and Fastify plugins (`@fastify/helmet`, `@fastify/csrf-protection`,
  `@fastify/rate-limit`) register via `app.register(...)`, not Express
  middleware via `app.use(...)`.
- Listen on `"0.0.0.0"`, not the Fastify default `"localhost"` — required for
  the app to be reachable from a Docker container or device on the network.

## Global validation — `nestjs-zod`

`ZodValidationPipe` replaces Nest's default `class-validator` pipe. DTOs are
generated **from the same `packages/shared` zod schema** the mobile client
validates against (`shared-contracts`) — there is exactly one schema per
shape, never a parallel `class-validator` DTO redeclaring the same fields.

```ts
// apps/api/src/modules/posts/dto/create-post.dto.ts
import { createZodDto } from "nestjs-zod";
import { createPostRequestSchema } from "@shared/contracts/post";

export class CreatePostDto extends createZodDto(createPostRequestSchema) {}
```

```ts
// apps/api/src/modules/posts/posts.controller.ts
import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { PostsService } from "./posts.service";
import { CreatePostDto } from "./dto/create-post.dto";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";

@Controller("posts") // -> /v1/posts (URI versioning enabled in main.ts)
export class PostsController {
  constructor(private readonly posts: PostsService) {}

  @Get()
  findAll(@Query() query: PaginationQueryDto) {
    return this.posts.findPage(query);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.posts.findOneOrThrow(id);
  }

  @Post()
  create(@Body() dto: CreatePostDto) {
    return this.posts.create(dto);
  }
}
```

```ts
// apps/api/src/modules/posts/posts.module.ts
import { Module } from "@nestjs/common";
import { PostsController } from "./posts.controller";
import { PostsService } from "./posts.service";

@Module({
  controllers: [PostsController],
  providers: [PostsService],
})
export class PostsModule {}
// PrismaModule is @Global (see database-orm) so PostsService can inject
// PrismaService without importing PrismaModule here.
```

A failed `ZodValidationPipe` throws a `ZodValidationException` — caught by
the exception filter below and turned into `api-design`'s `422` envelope, so
the controller body never has to think about validation failure at all.

## Guards, interceptors, pipes — execution order

Request flow through Nest, in order: **Guards** → **Interceptors** (before
handler) → **Pipes** (per-parameter) → **route handler** → **Interceptors**
(after handler, transforming the response) → **Exception filters** (only if
something threw). Keep each concern in its own class rather than stuffing
logic into the controller method:

```ts
// apps/api/src/common/interceptors/logging.interceptor.ts
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { tap } from "rxjs";
import type { FastifyRequest } from "fastify";

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const req = context.switchToHttp().getRequest<FastifyRequest>();
    const startedAt = Date.now();
    return next.handle().pipe(
      tap(() => {
        // eslint-disable-next-line no-console
        console.log(`${req.method} ${req.url} ${Date.now() - startedAt}ms`);
      }),
    );
  }
}
```

Guards decide **auth/RBAC** (`backend-auth-security`'s `JwtAuthGuard`/
`RolesGuard`), interceptors decide **cross-cutting behavior around a
response** (logging, timing, response shaping), pipes decide **is this
input well-formed** (`ZodValidationPipe`, `ParseUUIDPipe`). Don't put
authorization logic in an interceptor, or logging in a guard — each has one
job.

## ConfigModule — validated environment

Environment variables are parsed through a zod schema too, so a missing
`DATABASE_URL` or malformed `PORT` fails at boot, not on the first request
that needs it:

```ts
// apps/api/src/config/env.schema.ts
import { z } from "zod";

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  CORS_ORIGIN: z.string().optional(),
});
export type Env = z.infer<typeof envSchema>;
```

```ts
// apps/api/src/app.module.ts
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./prisma/prisma.module";
import { PostsModule } from "./modules/posts/posts.module";
import { envSchema } from "./config/env.schema";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config) => envSchema.parse(config),
    }),
    PrismaModule,
    PostsModule,
  ],
})
export class AppModule {}
```

Inject `ConfigService` wherever a value is needed
(`config.getOrThrow<string>("JWT_SECRET")`) — never read `process.env`
directly outside this schema, so every secret's presence is checked once at
boot (see `backend-auth-security` for how this backs the JWT strategy).

## Global exception filter

The single place that turns *any* thrown error — a Nest `HttpException`, a
`ZodValidationException`, or a truly unexpected bug — into `api-design`'s
error envelope:

```ts
// apps/api/src/common/filters/all-exceptions.filter.ts
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";
import type { FastifyReply } from "fastify";
import { ZodValidationException } from "nestjs-zod";

function messageFrom(body: unknown, fallback: string): string {
  if (typeof body === "string") return body;
  if (body && typeof body === "object" && "message" in body) {
    const msg = (body as { message?: unknown }).message;
    if (typeof msg === "string") return msg;
  }
  return fallback;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const reply = host.switchToHttp().getResponse<FastifyReply>();

    if (exception instanceof ZodValidationException) {
      return reply.status(422).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "Request failed validation",
          details: exception.getZodError().flatten(),
        },
      });
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      return reply.status(status).send({
        error: {
          code: HttpStatus[status] ?? "ERROR",
          message: messageFrom(exception.getResponse(), exception.message),
        },
      });
    }

    // Unexpected — log the real error server-side, never leak it to the client.
    // eslint-disable-next-line no-console
    console.error(exception);
    return reply.status(500).send({
      error: { code: "INTERNAL_SERVER_ERROR", message: "Something went wrong" },
    });
  }
}
```

## Do

- Bootstrap with `NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter())`
  — never the Express platform (`@nestjs/platform-express`) in this template.
- Generate every DTO with `createZodDto()` from a `@shared/contracts/*`
  schema — never hand-write a parallel `class-validator` DTO.
- Register `ZodValidationPipe` and `AllExceptionsFilter` globally, once, in
  `main.ts` — not per-controller.
- Keep one feature module per resource: `module` + `controller` + `service`
  + `dto/`.
- Read config only through `ConfigService`, backed by the zod-validated
  `envSchema`.

## Don't

- Don't register Express middleware (`app.use(cors())`) — use the Fastify
  adapter's own methods (`app.enableCors()`) or `app.register()` for Fastify
  plugins.
- Don't put a `try/catch` in every controller method to shape errors — the
  global exception filter already does this for the whole app.
- Don't read `process.env.X` directly in application code — go through
  `ConfigService` so a missing/malformed value fails at boot.
- Don't put authorization logic inside an interceptor or logging inside a
  guard — see `backend-auth-security` for where guards belong.
