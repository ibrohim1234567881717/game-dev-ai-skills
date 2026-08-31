---
name: web-typescript-patterns
description: Using TypeScript so the type system catches real bugs instead of decorating JavaScript. Covers the compiler flags that actually change outcomes, discriminated unions and exhaustive narrowing, generics that earn their complexity, preferring unknown over any, the split between compile-time types and runtime validation at trust boundaries, and end-to-end type-safe API contracts. Use when adding types to untyped code, when `as` casts are spreading, when a runtime error contradicts the types, or when designing the type of an API response.
license: MIT
metadata:
  uad-layer: platform
  uad-platform: web
  uad-domain: programming
  uad-version: "1.0.0"
  uad-requires: "api-design, secure-coding"
  uad-tags: "typescript, types, strict, discriminated union, narrowing, generics, unknown, zod, runtime validation, tsconfig"
  uad-maturity: stable
---

# Web TypeScript Patterns

## Purpose

TypeScript only prevents bugs where it is allowed to. A codebase with `strict`
off, `any` at every boundary and `as` scattered through it has the cost of
types and none of the benefit: the compiler agrees with statements that are
false at runtime. This skill covers the settings and patterns that make the
type system load-bearing, and, just as importantly, where types stop and
runtime validation must take over.

## When to use

- Configuring or tightening `tsconfig.json`, or adding TypeScript to a JS
  codebase.
- Modelling states that cannot coexist (loading/success/error, draft/published,
  authenticated/anonymous) where booleans and optional fields keep drifting.
- A runtime error contradicts a declared type, which always means a lie was
  introduced at a boundary.
- `as`, `any`, `!` or `@ts-expect-error` are accumulating and each one is
  hiding a real question.
- Designing the type of data crossing a trust boundary: HTTP response, form
  submission, environment variable, `localStorage`, message payload.
- Writing a generic utility or component and deciding how much parameterisation
  is worth the reading cost.

## When NOT to use

- For where modules and layers belong, use `web-frontend-architecture` or
  `web-backend-architecture`.
- For the HTTP contract itself, use `web-rest-api-design`.
- For hook typing, component props and re-render behaviour, use
  `web-react-patterns`.
- For module resolution, ESM/CJS interop and build configuration, use
  `web-project-conventions` and `web-node-backend`.
- When the file is plain JavaScript with JSDoc types and the project has chosen
  that deliberately; the reasoning transfers but the syntax does not.

## Required context

- **TypeScript version**, from the lockfile or `npx tsc --version`. Flags,
  inference and error messages differ across 5.x minors.
- **`tsconfig.json` and everything it extends or references**, including any
  `tsconfig.build.json` or per-package config in a monorepo. Read `strict`,
  `module`, `moduleResolution`, `target`, `lib`, `paths`, `noEmit`,
  `isolatedModules` and `verbatimModuleSyntax`.
- **Who compiles.** `tsc` emitting, `tsc --noEmit` for checking with a bundler
  (Vite, esbuild, SWC, Rollup) doing the transpile, or a runtime that strips
  types. Type-only transpilers do not see across files, which is why
  `isolatedModules` matters.
- **Runtime validation library already present**: `zod`, `valibot`,
  `@sinclair/typebox`, `arktype`, `io-ts`, `yup`. Adding a second is a
  maintenance tax with no benefit.
- **Generated types**: OpenAPI or GraphQL codegen output, Prisma client types,
  `supabase gen types`. Hand-writing what a generator already produces
  guarantees drift.

## Version constraints

Read the installed version rather than assuming the newest release; the
lockfile records what compiles this project.

- **TypeScript 5.0** added `const` type parameters, made decorators match the
  ECMAScript standard proposal, and introduced `moduleResolution: "bundler"`.
- **5.4** added `NoInfer<T>` and improved narrowing inside closures.
- **5.5** added inferred type predicates, so some hand-written `x is T`
  functions became unnecessary.
- **5.8** added `erasableSyntaxOnly`, which forbids the constructs that Node's
  type stripping cannot handle, notably `enum` and parameter properties.
- **A Go-based native compiler** is in preview. It is not the default toolchain;
  check what the project's `typecheck` script actually invokes.
- **Validation libraries move too.** Zod 4 changed error shapes and several
  APIs versus Zod 3, and is published alongside it, so `zod/v3` and `zod/v4`
  can both be reachable in one install. Confirm which is imported before
  copying an example.
- **`@types/*` packages** track their library's major separately from the
  library. A mismatched `@types/node` produces errors that no source change
  fixes.

## Workflow

1. **Read the effective compiler configuration first.** `npx tsc --showConfig`
   prints what is actually in force after `extends` resolution, which is
   frequently not what the file appears to say.
2. **Turn on `strict`, then the four flags beyond it that catch real bugs.**
   `strict` covers `strictNullChecks`, `noImplicitAny`,
   `strictFunctionTypes`, `strictPropertyInitialization` and
   `useUnknownInCatchVariables`. Add `noUncheckedIndexedAccess` (array and
   record access yields `T | undefined`, which is the truth),
   `exactOptionalPropertyTypes` (distinguishes absent from `undefined`),
   `noImplicitOverride`, and `noFallthroughCasesInSwitch`. On a legacy
   codebase, enable them one at a time and fix the resulting errors as separate
   changes.
3. **Model state as a discriminated union, not a bag of optionals.** Replace
   `{ loading: boolean; data?: T; error?: Error }`, which allows sixteen
   combinations of which twelve are nonsense, with
   `{ status: 'loading' } | { status: 'success'; data: T } | { status: 'error'; error: Error }`.
   The compiler then refuses to read `data` before the status is checked.
4. **Make exhaustiveness a compile error.** End every `switch` on a discriminant
   with a `default` that assigns the value to `never`. Adding a variant then
   breaks every incomplete switch, which is the entire point.
5. **Accept `unknown` at boundaries and narrow deliberately.** `unknown` forces
   a check; `any` disables checking for everything the value touches
   downstream. `catch (e)` gives `unknown` under `strict`, so narrow with
   `e instanceof Error` before reading `.message`.
6. **Validate at the boundary, then trust the types inside.** Every value that
   enters from outside the program, HTTP response, request body, query
   parameters, `process.env`, `localStorage`, `postMessage`, a file, gets
   parsed by a schema whose inferred type is the type the rest of the code
   uses. Derive the type from the schema so the two cannot diverge.
7. **Add generics only when a parameter's type genuinely relates two positions.**
   A type parameter that appears once in the signature is decoration; replace
   it with the concrete type or a constraint. Constrain with `extends` so error
   messages point at the caller instead of the implementation.
8. **Use `satisfies` instead of a type annotation** where you want the value
   checked against a type without widening its inferred literal types, such as
   a route table or a config object whose keys you then want to index.
9. **Type the API contract in one place and share it.** Generate types from an
   OpenAPI or GraphQL document, or share a schema module between server and
   client in a monorepo, or use an end-to-end typed RPC layer. Hand-maintained
   duplicate interfaces on both sides drift within a sprint.
10. **Treat every `as` as a claim you must justify.** Replace it with a type
    guard, a schema parse, or a better model. Where one is genuinely necessary
    (`as const`, narrowing after a runtime check the compiler cannot see),
    leave a comment saying why it is safe.

## Best practices

- Prefer `type` aliases for unions and function types; use `interface` where
  declaration merging or `implements` is wanted. Consistency inside a file
  matters more than the choice.
- Brand identifiers that must not be interchanged:
  `type UserId = string & { readonly __brand: 'UserId' }` makes passing an
  `OrderId` a compile error instead of a production incident.
- Use `readonly` on arrays and properties that must not be mutated; it costs
  nothing and documents intent the compiler enforces.
- Prefer union of string literals over `enum`. Literals are erasable, work with
  `const` objects, and do not create a runtime value that bundlers must keep.
- Keep `import type` explicit under `verbatimModuleSyntax` so the emitted
  JavaScript matches what you wrote and side-effect imports are not dropped.
- Let inference do the work for local variables and return values; annotate
  exported function signatures and module boundaries, where an accidental
  widening becomes an API change.
- Put shared types next to the code that owns them, not in a global
  `types.ts` that every module imports and nothing can be deleted from.
- Run `tsc --noEmit` in CI as its own step. A bundler that strips types will
  happily ship code that does not type-check.

## Common mistakes

- **`any` as an escape hatch.** It is contagious: every property access and
  call on an `any` is also `any`, so one cast disables checking across a whole
  call chain. Use `unknown` and narrow.
- **Casting a parsed JSON response.** `await res.json() as User` is a lie the
  compiler will now defend. `res.json()` returns `any`/`unknown` for a reason,
  the bytes came from the network. Parse with a schema.
- **Optional properties for mutually exclusive states.** Every consumer then
  needs defensive checks the compiler cannot verify, and the impossible
  combination eventually happens.
- **Non-null assertions after a length check.** `arr.find(...)!` compiles and
  throws in production when the predicate matches nothing. Handle the
  `undefined`.
- **Generic soup.** Three type parameters with conditional types to save four
  lines of duplication makes error messages unreadable and refactors
  impossible. Duplication is cheaper than an unreadable abstraction.
- **`@ts-ignore` instead of `@ts-expect-error`.** The former stays silent
  forever; the latter fails once the underlying problem is fixed, so it cleans
  itself up.
- **Trusting `strict: true` to mean the data is valid.** Types are erased at
  runtime. Nothing about `strict` stops an API returning `null` where the
  interface said `string`.
- **Enabling every strict flag at once on a large codebase**, producing
  thousands of errors and a branch nobody can review. Enable, fix, merge,
  repeat.
- **Duplicating server response types by hand on the client.** They agree on
  the day they are written and never again. Generate or share them.

## Validation

- `npx tsc --noEmit` exits 0. This is the baseline; run it before and after any
  change so failures are attributable.
- `npx tsc --showConfig` shows `"strict": true` and the extra flags you expect
  after `extends` resolution.
- Count the escape hatches and drive the number down:
  `grep -rnE "\bas any\b|: any\b|@ts-ignore" src/ | wc -l`. Passing means the
  count does not increase in a change, and each surviving instance has a
  comment.
- Enable `@typescript-eslint/no-unsafe-assignment`,
  `no-unsafe-member-access`, `no-floating-promises` and
  `no-misused-promises` with type-aware linting, then run
  `npx eslint . --max-warnings=0`. The promise rules catch a class of bug
  `tsc` alone does not.
- Write a negative test with `@ts-expect-error` over a call that must not
  compile, for example passing an `OrderId` where a `UserId` is required.
  Passing means `tsc` reports an error if the guard is ever removed.
- Feed a schema a deliberately wrong payload in a unit test and assert it
  throws or returns a failure result, proving validation is actually wired into
  the boundary rather than only declared.

## References

- [TypeScript tsconfig reference](https://www.typescriptlang.org/tsconfig)
- [TypeScript handbook, narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html)
- [TypeScript release notes](https://www.typescriptlang.org/docs/handbook/release-notes/overview.html)
- [typescript-eslint type-aware linting](https://typescript-eslint.io/getting-started/typed-linting/)
- [Zod documentation](https://zod.dev/)
- [openapi-typescript](https://openapi-ts.dev/)
