---
name: web-frontend-architecture
description: Framework-neutral structure for browser applications. Covers component boundaries, where state should live, the split between server cache and client state, data fetching architecture, rendering strategies (CSR, SSR, SSG, ISR, streaming) as concepts, and a folder structure that survives growth. Use when starting a frontend, when a feature is hard to place, when prop drilling or global state is spreading, or when deciding how a page should be rendered and where its data comes from.
license: MIT
metadata:
  uad-layer: platform
  uad-platform: web
  uad-domain: programming
  uad-version: "1.0.0"
  uad-requires: "software-architecture"
  uad-tags: "components, state management, data fetching, rendering, ssr, ssg, streaming, folder structure"
  uad-maturity: stable
---

# Web Frontend Architecture

## Purpose

Frontend code rots in predictable ways: state drifts upward until everything
re-renders, components accumulate responsibilities until they cannot be tested,
and data fetching scatters until nobody knows what triggers a request. This
skill gives the framework-neutral decisions that prevent that, so the
framework-specific skills only have to cover their own APIs.

## When to use

- Setting up a new frontend, or a new feature area inside an existing one.
- A component has grown past comprehension and needs splitting along a real
  boundary rather than an arbitrary line count.
- State is being lifted repeatedly, prop-drilled through layers, or duplicated
  between a store and server responses.
- Deciding how a route renders (static, server-rendered, client-rendered,
  streamed) and where its data is fetched.
- Loading, error and empty states are handled inconsistently across screens.

## When NOT to use

- For React-specific hook and re-render rules: use `web-react-patterns`.
- For Next.js server/client component boundaries and caching:
  use `web-nextjs-patterns`.
- For Vue or Svelte reactivity models: use `web-vue-svelte-patterns`.
- For layout and styling decisions: use `web-css-layout`.
- For measuring and fixing slowness: use `web-performance`. Architecture
  informs performance but is not a substitute for measurement.

## Required context

- **Framework and version**, from `package.json` and the lockfile, via
  `web-project-conventions`. Server components, resumability and islands change
  which of the options below are even available.
- **Rendering host**: `vite.config.*` (SPA or SSR), `next.config.*`,
  `astro.config.*`, `svelte.config.js` adapter. This decides whether a server
  render step exists at all.
- **Router**: file-based (Next, Nuxt, SvelteKit, TanStack Start) or
  configuration-based (React Router, Vue Router). Determines where route-level
  data loading belongs.
- **Existing state tooling**: any of `@tanstack/react-query`, `swr`, `zustand`,
  `redux`, `jotai`, `pinia`, `mobx` in `package.json`. Adding a second
  overlapping tool is nearly always the wrong move.
- **Where the data comes from**: REST, GraphQL, RPC (tRPC), or server actions.
  Read the API client module before designing the fetch layer.

## Version constraints

Verify against the installed versions, not the latest blog post.

- **Server components** exist in React 19 and are wired up by the framework
  (Next App Router, and increasingly others). In a plain Vite SPA they do not
  exist, and advice written for them does not apply.
- **Data-fetching libraries changed their APIs across majors**: TanStack Query
  v4 to v5 collapsed the overloads to a single object argument, renamed
  `cacheTime` to `gcTime`, `isLoading` semantics changed relative to
  `isPending`, and callbacks on `useQuery` were removed. Copying v4 examples
  into a v5 project produces silent no-ops.
- **Router majors move data loading**: React Router 6.4 introduced loaders and
  actions; React Router 7 merged with Remix conventions. Vue Router 4 is the
  Vue 3 line. Check which is installed before proposing route-level loaders.
- **Redux Toolkit** is the supported way to use Redux; hand-written reducers,
  `connect` and mutable-looking code without Immer belong to older codebases.
- **Streaming SSR** requires a server runtime that supports it and a framework
  version that exposes it (React 18+ `renderToPipeableStream` /
  `renderToReadableStream`). Confirm before designing around it.

## Workflow

1. **Establish the stack** with `web-project-conventions`. Record framework,
   router, state tooling and whether an SSR step exists.
2. **Choose the rendering strategy per route, not per app.** Marketing and docs
   pages: static (SSG), regenerated on a schedule or on demand. Personalised or
   auth-gated pages: server-rendered per request, or client-rendered behind an
   auth boundary. Highly interactive tools with no SEO requirement:
   client-rendered. Long-tail dashboards: server-rendered shell with streamed
   sections. Write the reason next to the choice.
3. **Separate server cache from client state.** Anything that originates on the
   server (lists, entities, search results) belongs in a query cache keyed by
   its request parameters, with staleness rules. Anything that exists only in
   the browser (open dialogs, form drafts, selected tab, wizard step) is client
   state. Do not copy fetched data into a global store; that is where staleness
   bugs come from.
4. **Place client state at the lowest common ancestor of its readers.** Start
   local. Lift only when a second component genuinely needs it. Reach for a
   store only when the state is read by distant subtrees and outlives the
   components that write it (session, theme, feature flags, cart).
5. **Define component boundaries by responsibility.** A component that fetches,
   decides layout, formats values and handles submission is four components.
   Split into: route/page (composition and data), container (state and
   handlers), presentational (props in, markup out), and primitives (design
   system). A boundary is real when the two halves have different reasons to
   change.
6. **Centralise the transport, not the endpoints.** One HTTP client module owns
   base URL, auth headers, timeouts, retries and error normalisation. Each
   feature exposes typed functions on top of it. Components never call `fetch`
   directly.
7. **Model every async surface with four states**: idle/loading, success,
   empty, error. Build the empty and error states at the same time as the happy
   path; retrofitting them is what produces blank screens in production.
8. **Structure folders by feature, not by file type.** `src/features/checkout/`
   holding its components, hooks, api and tests scales; `src/components/`,
   `src/hooks/`, `src/utils/` as top-level buckets stop scaling around thirty
   files. Keep genuinely shared code in `src/shared/` (or `src/lib/`) and let
   the dependency direction run feature to shared, never shared to feature.
9. **Enforce the boundaries mechanically** with lint rules (import
   restrictions), a path alias per layer, or workspace packages, so the design
   survives contributors who have not read this.

## Best practices

- Colocate: a component's styles, tests, stories and hooks live next to it.
  Distance from the thing you are editing is the tax you pay every change.
- Derive instead of storing. If a value can be computed from existing state,
  compute it. Duplicated derived state is guaranteed to diverge.
- Keep URL state in the URL. Filters, pagination, tabs and selected ids belong
  in query parameters so that reload, share and back all work.
- Make the data flow one-directional: props and events down and up, cache
  invalidation as the only "action at a distance".
- Prefer composition (children, slots, render props) over configuration flags.
  A component with eight booleans is several components wearing a trenchcoat.
- Suspend or gate on data at route boundaries so that a page has one loading
  story rather than fifteen independent spinners.
- Type the boundary between network and UI once, and validate it at runtime
  (see `web-typescript-patterns`); the rest of the app can then trust its types.
- Ship an error boundary per route segment so a failure degrades one region
  instead of blanking the app.

## Common mistakes

- **Putting server data in a global client store.** It has to be invalidated,
  refetched, deduplicated and garbage-collected, so you end up rebuilding a
  query cache badly. Use the query library that is already installed.
- **Lifting state to the root to avoid prop drilling.** Every update now
  re-renders the tree, and the state's real owner is invisible. Move the
  consumer closer, compose with children, or use a scoped context.
- **A `components/` folder as the only organising principle.** After a hundred
  components nobody can tell what belongs to what, and deleting a feature means
  hunting across five directories.
- **Fetching in a leaf component.** Waterfalls: the leaf cannot start until its
  ancestors render, so requests serialise. Hoist the fetch to the route or use
  the framework's loader.
- **Treating loading as a boolean.** `isLoading` cannot express refetching,
  optimistic updates, or partial failure, and produces flashing spinners on
  cached data.
- **Choosing SSR for everything by default.** It moves cost to the server, adds
  a hydration step and complicates auth, for pages that had no SEO or
  time-to-content requirement.
- **Duplicating form state into a store.** Forms are local by nature; keep them
  in the form library or component until submit.

## Validation

- Draw the dependency graph with `npx madge --circular src/` (or
  `dependency-cruiser` with a rule per layer). Passing means zero cycles and no
  import from `shared/` into `features/`.
- Grep for direct network calls outside the client module:
  `grep -rn "fetch(" src/ --include=*.ts --include=*.tsx | grep -v src/lib/api`
  should return nothing.
- Open the Network panel, hard-reload a route, and check the request waterfall.
  Passing means requests for a route start in parallel, not in a staircase.
- Disable the network (DevTools offline) and load each route. Passing means an
  error state renders, not a blank page or an infinite spinner.
- Turn off JavaScript and load a route that claims to be server-rendered.
  Passing means meaningful HTML is present in the response body
  (`curl -s <url> | grep -c "<h1"` returns at least 1).
- Confirm state placement: for each store slice, name at least two distant
  consumers. If there is only one, it should not be global.

## References

- [React: Sharing state between components](https://react.dev/learn/sharing-state-between-components)
- [TanStack Query: important defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults)
- [MDN: Client-side rendering and SSR overview](https://developer.mozilla.org/en-US/docs/Glossary/SSR)
- [web.dev: Rendering on the web](https://web.dev/articles/rendering-on-the-web)
- [dependency-cruiser](https://github.com/sverweij/dependency-cruiser)
