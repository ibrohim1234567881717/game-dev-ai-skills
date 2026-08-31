---
name: web-backend-architecture
description: Framework-neutral structure for HTTP backends and services. Covers the transport/service/data layering and which way dependencies point, validating untrusted input at the edge, a single error taxonomy mapped to status codes, configuration and secret handling, background and scheduled work, and the statelessness that horizontal scaling requires. Use when starting a server, when route handlers have grown to hold business logic, when the same rule is enforced in three places, when adding a queue or cron job, or when a second instance of the process breaks something.
license: MIT
metadata:
  uad-layer: platform
  uad-platform: web
  uad-domain: programming
  uad-version: "1.0.0"
  uad-requires: "software-architecture"
  uad-tags: "backend, layering, services, validation, error handling, configuration, secrets, queues, background jobs, scaling, stateless"
  uad-maturity: stable
---

# Web Backend Architecture

## Purpose

Backends fail structurally long before they fail technically. Business rules
end up inside route handlers, so they cannot be reused or tested; the database
schema leaks into HTTP responses, so a column rename becomes a breaking API
change; state lives in process memory, so the second instance behaves
differently from the first. This skill gives the framework-neutral structure
that avoids that, applicable whether the server is Express, Fastify, Hono,
NestJS, Next route handlers or a serverless function.

## When to use

- Starting a backend service, or adding a substantial feature area to one.
- A route handler has grown past a screen and mixes parsing, authorisation,
  business rules and persistence.
- The same validation or permission rule exists in more than one place and the
  copies have started to disagree.
- Errors reach the client as stack traces, HTML pages, or a 200 with an error
  body.
- Introducing background work (queue consumer, cron, webhook processing) and
  deciding what may run inside a request.
- Scaling from one process to several, or moving to a platform that can
  restart the process at any moment.

## When NOT to use

- For the shape of the HTTP interface itself, resources, status codes and
  pagination, use `web-rest-api-design`.
- For schema, indexing, transactions and query performance, use
  `web-database-data-layer`.
- For Node runtime specifics such as the event loop, streams and graceful
  shutdown, use `web-node-backend`.
- For login, sessions and tokens, use `web-authentication`; for an attack-facing
  review, use `web-security`.
- For pipelines, environments and rollout, use `web-deployment`.

## Required context

- **Runtime and framework**, from `package.json` and the lockfile, via
  `web-project-conventions`. Serverless functions, a long-lived Node server and
  an edge runtime have different rules about memory, background work and
  connections.
- **Entry point and routing style**: a single `app.ts` with a router tree,
  file-based routes, or a controller/decorator framework. This determines where
  the transport layer physically lives.
- **Persistence**: which client is in use (`pg`, `prisma`, `drizzle-orm`,
  `mongoose`, `kysely`) and whether a schema or migration directory exists.
- **Existing validation library**: `zod`, `valibot`, `@sinclair/typebox`,
  `joi`, `class-validator`, or the framework's own schema support. Do not add a
  second one.
- **Configuration source**: `.env.example`, `docker-compose.yml`, a secrets
  manager client, or platform environment variables. Read it before inventing a
  config key.
- **Deployment target**: container, serverless, edge, or a long-running VM.
  It decides whether in-process timers and caches are viable at all.

## Version constraints

Read the installed versions from `package.json` and the lockfile before writing
code; the lockfile is what is actually installed. Things that differ by major
and change what correct code looks like:

- **Express 5** propagates rejected promises from async handlers to the error
  middleware; Express 4 does not, and an unhandled rejection there silently
  hangs the request. Express 5 also changed path-matching syntax, so wildcard
  and optional-parameter routes written for 4 do not all compile.
- **Fastify 4 to 5** changed plugin lifecycle and dropped Node versions;
  schema-based validation and serialization remain the idiomatic path.
- **NestJS majors** track Express/Fastify majors and change decorator and
  module resolution behaviour.
- **Node** is the constraint under all of it. Node 18 is end of life; native
  `fetch`, the stable built-in test runner, `--env-file` and `require()` of ESM
  are all version-gated. Check `engines.node`, `.nvmrc` and the CI matrix.
- **Validation libraries** break across majors. Zod 4 changed error formatting
  and several APIs relative to Zod 3; code written for one produces
  wrong-shaped errors on the other.

## Workflow

1. **Establish the stack** with `web-project-conventions` and record runtime,
   framework, persistence client and validation library.
2. **Draw three layers and one direction.** Transport (HTTP, queue consumer,
   CLI, cron) depends on service; service depends on data-access ports;
   nothing depends on transport. A service function must be callable from an
   HTTP handler, a job and a test without any of them knowing about the others.
   In practice that means a service takes plain arguments and returns plain
   values, never `req` and `res`.
3. **Validate at the edge and only there.** Parse the request body, query,
   params and headers into a typed value at the entry point. Everything past
   that boundary receives validated data and may assume it. Reject unknown
   fields rather than passing them through, so mass assignment cannot reach the
   data layer.
4. **Separate authentication, authorisation and business rules.** Middleware
   establishes who the caller is. The service decides whether this caller may
   act on this specific resource, because only the service can load the
   resource to check ownership. Route-level role checks alone cannot express
   "the author of this comment".
5. **Define one error taxonomy** in a single module, with a small set of
   domain errors (validation failed, not found, not permitted, conflict, rate
   limited, upstream unavailable, unexpected). Services throw those. One
   translation layer at the transport edge maps them to status codes and the
   response body, so no handler formats errors by hand.
6. **Isolate the data layer behind functions, not the ORM.** Feature code calls
   `findOrdersForCustomer(id)`, not a query builder inline. That is what makes
   the query reviewable, testable, and replaceable when the query plan turns
   out to be bad.
7. **Load configuration once, at startup, through a schema.** Parse
   `process.env` into a typed, frozen config object and fail fast on a missing
   or malformed value. A server that boots and then throws on the first request
   because `DATABASE_URL` was empty has wasted the deploy's health check.
8. **Move slow and unreliable work out of the request.** Anything that can take
   seconds, call a third party, or need a retry belongs in a queue with an
   explicit retry policy, a dead-letter destination and idempotent consumers.
   Return 202 with a way to observe progress rather than holding the
   connection.
9. **Make the process stateless.** Sessions, caches, rate-limit counters,
   uploaded files, locks and scheduler state go to shared infrastructure, not
   module-level variables. The test is simple: two instances behind a load
   balancer must be indistinguishable to a client.
10. **Add observability at the boundaries you just defined.** A request id
    generated or propagated at the transport edge, carried through the service
    call, logged with every line, and returned in the response makes production
    debugging possible.

## Best practices

- Keep handlers thin enough to read in one screen: parse, call a service,
  translate the result. If a handler has a conditional about business meaning,
  it belongs in the service.
- Pass a request-scoped context object (user, request id, tracing span,
  abort signal) explicitly, or via `AsyncLocalStorage`, rather than a global.
- Make writes idempotent where the caller may retry. A client that times out
  will retry, and a duplicate charge is worse than a failed one.
- Set a timeout and an `AbortSignal` on every outbound call. Without one, a
  slow dependency turns into exhausted connections and a dead service.
- Log structured JSON with a level, message, request id and error cause, never
  interpolated strings. Redact tokens, cookies, passwords and personal data at
  the logger, not at each call site.
- Read secrets from the environment or a secret manager at startup; never
  commit them, never log them, never send them to the client. Rotate by
  restarting with new values, which is only possible if config is read once.
- Bound every list operation. Unpaginated collection endpoints and unbounded
  `IN` clauses work in development and fall over on real data.
- Health endpoints belong in the transport layer and must be honest: liveness
  says the process is alive, readiness says dependencies are reachable.
- Keep migrations backward compatible with the currently deployed code, because
  during a rollout both versions run at once.

## Common mistakes

- **Business logic in route handlers.** Tempting because it is the shortest
  path to a working endpoint. It cannot be reused by a job or a second
  endpoint, and testing it requires simulating HTTP.
- **Validating in the service instead of the edge.** Types then lie: the
  service signature claims `string` while the value arrived as `undefined`.
  Parse once, at the boundary, and let the types be true afterwards.
- **Returning ORM entities directly.** The response now mirrors the table,
  including columns like `password_hash`, `internal_notes` and
  `deleted_at`. Map to an explicit response shape.
- **Catch-and-log-and-continue.** Swallowing an error produces a 200 with
  half-written state. Let it propagate to the single error translator.
- **In-memory rate limiters, caches and sessions.** They work on one instance
  and become meaningless on three, where each holds a fraction of the truth.
- **`setInterval` for scheduled work in a scaled service.** Every instance runs
  the job, so the nightly email goes out N times. Use a scheduler with leader
  election or an external cron trigger.
- **Reading `process.env` deep in the code.** Configuration becomes untraceable
  and untestable, and a typo fails at runtime in one code path only.
- **Trusting the client for anything authoritative.** Prices, roles, ownership,
  totals and timestamps are recomputed on the server. See `client-server-trust`.
- **One giant `utils` module** that everything imports, which quietly creates a
  cycle between layers and defeats the dependency direction.

## Validation

- `npx madge --circular src/` (or `dependency-cruiser` with a rule forbidding
  `service -> transport` imports) reports zero cycles and zero violations.
- Grep for framework types leaking inward:
  `grep -rn "req\.\|Request\b" src/services src/domain` returns nothing.
- Start the server with a required environment variable removed. Passing means
  it exits non-zero at startup with a message naming the variable, not a 500
  on the first request.
- `curl -i -X POST localhost:3000/api/<resource> -H 'content-type: application/json' -d '{}'`
  returns 400 with a structured error body and no stack trace.
- Send a body with an unexpected field such as `"role":"admin"`. Passing means
  the field is rejected or dropped, and the stored record is unchanged.
- Run two instances behind a proxy, log in on one, and make a request that the
  proxy routes to the other. Passing means the second instance behaves
  identically.
- Send `SIGTERM` while a request is in flight. Passing means the in-flight
  request completes, no new connections are accepted, and the process exits
  within the platform's grace period.
- Check log output for secrets: `grep -riE "authorization|password|secret" logs/`
  returns only redacted placeholders.

## References

- [The Twelve-Factor App](https://12factor.net/)
- [MDN HTTP guides](https://developer.mozilla.org/en-US/docs/Web/HTTP)
- [Express 5 migration guide](https://expressjs.com/en/guide/migrating-5.html)
- [Fastify validation and serialization](https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/)
- [Node.js AsyncLocalStorage](https://nodejs.org/api/async_context.html)
- [OpenTelemetry for JavaScript](https://opentelemetry.io/docs/languages/js/)
