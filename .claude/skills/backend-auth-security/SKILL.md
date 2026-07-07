---
name: backend-auth-security
description: Use when implementing authentication guards, a Passport JWT/session strategy, role-based access control, CORS/CSRF, security headers, or secrets handling in apps/api. Pairs with nestjs-backend for how guards attach to the app, and mobile-auth-state for the client side of the same JWT flow.
---

# backend-auth-security

Auth and hardening for `apps/api`: Passport JWT strategy, a default-deny
global guard with an explicit `@Public()` opt-out, an `RolesGuard` for RBAC,
CORS, CSRF reasoning, `@fastify/helmet`, secrets via `ConfigService`, and
where this template stands against the OWASP Top 10.

## Goal

Every route is authenticated by default; a route opts **out** with
`@Public()`, never the other way around (opting in per-route is one missed
decorator away from an accidentally-public endpoint). Every secret comes
from `ConfigService`, never a hard-coded string. RBAC is declarative
(`@Roles(...)`), not scattered `if (user.role === ...)` checks in service
methods.

## Passport JWT strategy

```bash
pnpm --filter api add @nestjs/passport @nestjs/jwt passport passport-jwt
pnpm --filter api add -D @types/passport-jwt
```

```ts
// apps/api/src/auth/jwt.strategy.ts
import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";

interface JwtPayload {
  sub: string;
  email: string;
  roles: string[];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>("JWT_SECRET"),
    });
  }

  validate(payload: JwtPayload) {
    // Whatever this returns becomes `req.user`. Keep it to what the payload
    // already carries — don't hit the DB on every authenticated request just
    // to re-fetch the user; re-fetch inside a specific handler if it needs
    // fresher data than the token carries.
    return { userId: payload.sub, email: payload.email, roles: payload.roles };
  }
}
```

```ts
// apps/api/src/auth/auth.module.ts
import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { JwtStrategy } from "./jwt.strategy";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>("JWT_SECRET"),
        signOptions: { expiresIn: "15m" }, // short-lived access token; see mobile-auth-state for refresh
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [JwtStrategy, AuthService, { provide: APP_GUARD, useClass: JwtAuthGuard }],
  exports: [AuthService],
})
export class AuthModule {}
```

## Default-deny global guard with an explicit opt-out

Registering `JwtAuthGuard` as `APP_GUARD` makes **every** route
authenticated unless explicitly marked `@Public()` — a new endpoint is
secure by default, not by remembering to add a guard:

```ts
// apps/api/src/auth/public.decorator.ts
import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

```ts
// apps/api/src/auth/jwt-auth.guard.ts
import { ExecutionContext, Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Reflector } from "@nestjs/core";
import { IS_PUBLIC_KEY } from "./public.decorator";

@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }
}
```

```ts
// apps/api/src/auth/auth.controller.ts
import { Body, Controller, Post } from "@nestjs/common";
import { Public } from "./public.decorator";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto"; // createZodDto over a shared-contracts login schema

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post("login")
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }
}
```

## RBAC — `RolesGuard`

```ts
// apps/api/src/auth/roles.decorator.ts
import { SetMetadata } from "@nestjs/common";

export type Role = "admin" | "member";
export const ROLES_KEY = "roles";
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
```

```ts
// apps/api/src/auth/roles.guard.ts
import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { FastifyRequest } from "fastify";
import { ROLES_KEY, type Role } from "./roles.decorator";

interface AuthedUser {
  userId: string;
  roles: Role[];
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest<FastifyRequest & { user: AuthedUser }>();
    return required.some((role) => req.user.roles.includes(role));
  }
}
```

```ts
@Roles("admin")
@UseGuards(RolesGuard) // runs after the global JwtAuthGuard has already populated req.user
@Delete(":id")
remove(@Param("id") id: string) {
  return this.posts.remove(id);
}
```

`RolesGuard` always runs **after** `JwtAuthGuard` (guard order = declaration
order; the global one always runs first), so `req.user` is guaranteed
populated by the time it checks roles.

## CORS and CSRF

```ts
// apps/api/src/main.ts (excerpt — full bootstrap in nestjs-backend)
app.enableCors({
  origin: process.env.CORS_ORIGIN?.split(",") ?? false, // explicit allowlist, never `origin: true` in production
  credentials: true,
});
```

- This template authenticates with a **bearer JWT in the `Authorization`
  header** (`mobile-auth-state`), not a cookie — a header the browser never
  attaches automatically, so classic CSRF (a malicious site making the
  browser send an authenticated request without the user's input) doesn't
  apply to it. CORS above still matters: it's what stops a browser page on
  another origin from reading the response even if it could send the
  request.
- If a future endpoint switches to cookie-based sessions instead of bearer
  JWT, add `@fastify/csrf-protection` at that point — cookie auth genuinely
  needs CSRF tokens; bearer-header auth doesn't, and adding CSRF protection
  to a header-only API is complexity with no corresponding risk it defends
  against.

## Security headers — `@fastify/helmet`

```bash
pnpm --filter api add @fastify/helmet
```

```ts
// apps/api/src/main.ts (excerpt)
import helmet from "@fastify/helmet";

await app.register(helmet, {
  contentSecurityPolicy: process.env.NODE_ENV === "production" ? undefined : false,
});
```

Registered as a Fastify plugin (`app.register`), not Express middleware —
consistent with the Fastify-adapter bootstrap in `nestjs-backend`.

## Secrets via `ConfigService`

Never hard-code `JWT_SECRET`, `DATABASE_URL`, or any third-party API key —
read them through `ConfigService`, backed by `nestjs-backend`'s zod-validated
`envSchema`, sourced from `.env` (gitignored) locally and the deploy
platform's secret store in every other environment:

```ts
config.getOrThrow<string>("JWT_SECRET"); // throws at the call site if somehow missing at runtime
```

`getOrThrow` over plain `.get()` for anything the app cannot run without —
fail loudly at the point of use rather than silently proceeding with
`undefined`.

## OWASP Top 10 — where this template stands

| Category | Mitigation in this stack |
|---|---|
| Broken Access Control | Default-deny `JwtAuthGuard` + `@Public()` opt-out; `RolesGuard` for RBAC |
| Cryptographic Failures | Secrets via `ConfigService`/env only; hash passwords with `argon2`/`bcrypt`, never store plaintext; TLS terminated at the load balancer/platform |
| Injection | Prisma parameterizes every query (`database-orm`); every input validated by `nestjs-zod` before it reaches a service |
| Insecure Design | Threat-model new features during `brainstorming`/`api-design`, before writing code |
| Security Misconfiguration | `@fastify/helmet` defaults; explicit CORS allowlist, never `origin: true`; exception filter never leaks stack traces to the client |
| Vulnerable Components | `pnpm audit` in CI; keep dependencies current |
| Identification/Auth Failures | Short-lived (15 min) access tokens + rotating refresh tokens (`mobile-auth-state`); rate-limit `/auth/login` with `@fastify/rate-limit` |
| Software/Data Integrity Failures | Committed lockfile (`pnpm-lock.yaml`); verify signatures on any third-party webhook payload before trusting it |
| Logging/Monitoring Failures | Structured request logging (`nestjs-backend`'s `LoggingInterceptor`); never log tokens, passwords, or full request bodies containing secrets |
| Server-Side Request Forgery | Never fetch a URL supplied by user input without an allowlist; validate/normalize any outbound-URL field through a zod schema first |

## Do

- Register the JWT guard globally (`APP_GUARD`); mark individual routes
  `@Public()`, never the reverse.
- Put role checks in `RolesGuard` + `@Roles()`, not inline in service logic.
- Read every secret through `ConfigService.getOrThrow`.
- Register `@fastify/helmet` and an explicit CORS origin allowlist.

## Don't

- Don't build a per-route opt-in auth guard — one forgotten decorator on a
  new endpoint means it's silently public.
- Don't add CSRF-token middleware to a bearer-JWT-only API — it defends
  against a risk this auth scheme doesn't have; add it only if/when cookie
  sessions are introduced.
- Don't hard-code `JWT_SECRET` or any credential in source — `.env`
  (gitignored) or the platform's secret store only.
- Don't let the global exception filter leak a raw stack trace or internal
  error message to the client in production (`nestjs-backend`'s
  `AllExceptionsFilter` already guards this — don't bypass it with a
  per-route try/catch that re-exposes the raw error).
