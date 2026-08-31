---
name: web-project-conventions
description: Entry skill for any JavaScript or TypeScript web codebase. Establishes framework, package manager, runtime, module system, TypeScript strictness, test runner and monorepo layout by reading package.json, the lockfile and the config files, before writing code or running commands. Use it first when opening an unfamiliar web project, when a build or test command is ambiguous or failing, when adding a dependency, or whenever you are tempted to assume a framework version.
license: MIT
metadata:
  uad-layer: platform
  uad-platform: web
  uad-domain: programming
  uad-version: "1.0.0"
  uad-requires: "dependency-analysis"
  uad-tags: "entry, package.json, lockfile, package manager, monorepo, workspaces, scripts, tooling"
  uad-maturity: stable
---

# Web Project Conventions

## Purpose

Every other web skill assumes it knows the framework, its major version, the
package manager, the runtime and how to run the tests. This skill establishes
those facts from the repository itself, so nothing downstream has to guess.
Guessing is the dominant failure mode in web work: the ecosystem ships breaking
majors yearly, and code written for the newest release silently misbehaves in a
project pinned two majors back.

## When to use

- First contact with a repository containing `package.json`, before reading
  application code or proposing a change.
- Before running any build, test, lint or dev command, to learn the project's
  actual script names rather than inventing `npm run build`.
- Before adding, upgrading or removing a dependency.
- When a command fails with "unknown option", "cannot find module", or an
  unexpected ESM/CJS error, which usually means the wrong tool or runtime.
- When a monorepo makes "the project" ambiguous and you need to know which
  package you are actually editing.

## When NOT to use

- For deciding application structure once the stack is known: use
  `web-frontend-architecture` or `web-backend-architecture`.
- For framework-specific behaviour: use `web-react-patterns`,
  `web-nextjs-patterns`, `web-node-backend` or `web-vue-svelte-patterns`.
- For CI pipeline design or environment promotion: use `web-deployment`.
- For non-Node web output (a static site with no `package.json`, a PHP or Rails
  app serving HTML), where there is no manifest to read.

## Required context

Establish these before any other action. Each has one file that answers it.

- **Package manager.** `packageManager` field in `package.json`, then the
  lockfile that exists: `pnpm-lock.yaml` (pnpm), `package-lock.json` (npm),
  `yarn.lock` (Yarn), `bun.lock` or `bun.lockb` (Bun). If the field and the
  lockfile disagree, the lockfile is what the last install actually used; say
  so rather than silently switching.
- **Installed versions.** `dependencies` and `devDependencies` in
  `package.json` give ranges (`^15.2.0`); the lockfile gives the exact resolved
  version. Read the lockfile when the distinction matters, which for majors it
  always does.
- **Runtime.** `engines.node` in `package.json`, plus `.nvmrc`,
  `.node-version`, `.tool-versions`, or a `FROM node:` line in a Dockerfile.
  `deno.json` or `bun.lock` mean the runtime is not Node.
- **Module system.** `"type": "module"` in `package.json` means `.js` files are
  ESM; its absence means CJS. `exports` and `main` fields describe what
  consumers get. See `web-node-backend` for the consequences.
- **TypeScript setup.** `tsconfig.json` (and any `tsconfig.*.json` it extends
  or references): `strict`, `module`, `moduleResolution`, `target`, `paths`,
  `noEmit`. `paths` aliases explain imports that look unresolvable.
- **Scripts.** The `scripts` block is the contract for how this project builds,
  tests and runs. It, not habit, is the source of truth.
- **Monorepo layout.** `workspaces` in `package.json`, `pnpm-workspace.yaml`,
  `turbo.json`, `nx.json`, `lerna.json`, or a `rush.json`. These tell you where
  packages live and which commands run from the root versus a package.
- **Enforced style.** `eslint.config.js` / `.eslintrc.*`, `biome.json`,
  `.prettierrc*`, `.editorconfig`. Match the project; do not reformat files.

## Version constraints

Read versions, never assume them. The ranges in `package.json` are intent; the
lockfile records what is installed. `npm ls <pkg>`, `pnpm why <pkg>` or
`yarn why <pkg>` resolve the truth including transitive duplicates.

Things that differ by major and change what correct code looks like:

- **Package managers.** npm 7+ installs peer dependencies automatically; npm 9+
  removed several legacy flags. pnpm uses a symlinked, strict `node_modules` by
  default, so packages that rely on hoisted transitive deps break until
  `node-linker` or `public-hoist-pattern` is set. pnpm 10 stopped running
  dependency lifecycle scripts by default (`onlyBuiltDependencies` opts back
  in), which changes native-module installs. Yarn 4 (Berry) with
  `nodeLinker: pnp` has no `node_modules` at all, and tools must be run through
  `yarn <cmd>`. Bun resolves and runs differently from Node.
- **Node.** Node 18 reached end of life in April 2025; anything targeting it is
  unsupported. Node 20, 22 and 24 differ in ESM/CJS interop, built-in test
  runner maturity and TypeScript handling. Check `engines`, `.nvmrc` and CI
  before assuming a built-in exists.
- **Corepack.** `packageManager` is enforced only when Corepack is enabled, and
  Corepack's bundling with Node has changed across recent majors. Verify with
  `corepack --version` instead of assuming it is available.
- **TypeScript.** 5.x changed `moduleResolution` defaults (`bundler` exists
  from 5.0) and added `verbatimModuleSyntax`; a Go-based native compiler is in
  preview and not yet the default toolchain. Read the installed version with
  `npx tsc --version`.
- **Frameworks.** Next, React, Vue, Svelte, Vite and Tailwind have all shipped
  majors with breaking configuration changes. Their skills cover the specifics;
  this skill's job is to hand them the real number.

## Workflow

1. **Locate the manifests.** Find every `package.json` (excluding
   `node_modules`). One means a single package; several plus a workspace file
   mean a monorepo, and you must identify which package the task belongs to
   before editing.
2. **Read the root `package.json` end to end.** Record `name`, `private`,
   `type`, `packageManager`, `engines`, `workspaces`, `scripts` and the
   dependency blocks. Do not skim: `type` and `engines` change what code is
   valid.
3. **Identify the package manager and confirm the lockfile matches.** Exactly
   one lockfile should exist. Two mean the repo has been installed with
   different tools and dependency versions are not what anyone thinks; report it.
4. **Resolve real versions from the lockfile** for the framework, the runtime
   libraries you will touch, and the test runner. Quote them in your reasoning
   so later steps cannot drift back to assumptions.
5. **Read the config files that exist**: `tsconfig.json`, the bundler config
   (`vite.config.*`, `next.config.*`, `webpack.config.*`, `rollup.config.*`),
   the test config (`vitest.config.*`, `jest.config.*`, `playwright.config.*`),
   and the lint/format config. Each one narrows what "correct" means here.
6. **Derive the commands from `scripts`.** Build, test, lint, typecheck and dev
   all come from that block, invoked with the project's package manager
   (`pnpm test`, `npm run test`, `yarn test`, `bun run test`). In a monorepo,
   note whether the script is a root orchestrator (Turbo/Nx) or a package-local
   script.
7. **Check for environment prerequisites** before running anything:
   `.env.example`, `docker-compose.yml`, a `prisma/schema.prisma` needing a
   database, or a `postinstall` step. A test suite that needs a database will
   fail confusingly without one.
8. **State the established stack** in one short block (framework + version,
   package manager, runtime, TS strictness, test runner, monorepo tool) and
   only then start the actual task.

## Best practices

- Use the project's package manager for every command. Running `npm install` in
  a pnpm repo rewrites the dependency graph and creates a second lockfile.
- Prefer `npm ci` / `pnpm install --frozen-lockfile` / `yarn install
  --immutable` in any automated context: they fail on lockfile drift instead of
  quietly updating it.
- Always commit the lockfile for applications. Libraries publish ranges, but the
  app that installs them needs reproducibility.
- Treat `scripts` as the public interface. If a task needs a new command, add a
  script rather than documenting a long ad-hoc invocation.
- Keep build tools in `devDependencies` and runtime imports in `dependencies`.
  Getting this backwards breaks production installs that skip dev deps.
- In a monorepo, run the narrowest command that covers the change
  (`pnpm --filter @app/web test`) and the full graph only before handing off.
- Record any assumption you could not verify, rather than proceeding silently.

## Common mistakes

- **Assuming the newest framework version.** Writing Next 15 async `params` or
  Svelte 5 runes into a project pinned to the previous major produces code that
  type-checks against the wrong docs and fails at runtime. Read the lockfile.
- **Reading `package.json` ranges as installed versions.** `^15.0.0` may have
  resolved to any 15.x; a bug fixed in 15.3 is still present if the lockfile
  says 15.1.
- **Running `npm install` in a pnpm or Yarn repo.** Produces a second lockfile,
  a different (hoisted) module layout, and a diff nobody can review. Check the
  lockfile first.
- **Inventing script names.** `npm run build` fails or, worse, runs a different
  build than CI does. The `scripts` block is authoritative.
- **Ignoring `"type": "module"`.** Adding a CommonJS `require` to an ESM package
  throws `ReferenceError: require is not defined`; adding top-level `await` to a
  CJS file fails to parse.
- **Editing the wrong workspace package.** In a monorepo, `src/` exists in many
  places. Confirm the package from the import path or the failing test's file
  path before editing.
- **Upgrading a major "while you are in there".** A major bump is its own
  change with its own migration guide and its own review.

## Validation

Run these from the repository root and confirm the stated result:

- `cat package.json` and `ls *lock*` produce exactly one lockfile, and it
  matches the `packageManager` field when present.
- `<pm> install --frozen-lockfile` (pnpm), `npm ci`, `yarn install --immutable`
  or `bun install --frozen-lockfile` completes with no lockfile modification.
  A modified lockfile after this command is a failure, not a warning.
- `node --version` satisfies `engines.node`. Compare literally; `>=20` is not
  satisfied by 18.
- `npx tsc --noEmit` (or the project's `typecheck` script) exits 0 before you
  start, so any later type error is attributable to your change.
- The project's own test script runs and reports a baseline result. If it fails
  before your change, say so and establish why before doing anything else.
- `npm ls <framework>` / `pnpm why <framework>` prints a single resolved
  version. Multiple copies of React or a bundler explain otherwise inexplicable
  runtime bugs.

## References

- [npm package.json fields](https://docs.npmjs.com/cli/configuring-npm/package-json)
- [Node.js release schedule and support](https://github.com/nodejs/release)
- [pnpm workspaces](https://pnpm.io/workspaces)
- [Yarn workspaces and Plug'n'Play](https://yarnpkg.com/features/pnp)
- [TypeScript tsconfig reference](https://www.typescriptlang.org/tsconfig)
- [Corepack documentation](https://nodejs.org/api/corepack.html)
