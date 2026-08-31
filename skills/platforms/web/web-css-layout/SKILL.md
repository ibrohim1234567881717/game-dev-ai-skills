---
name: web-css-layout
description: Building layout and visual systems in CSS that survive real content. Covers choosing between flexbox and grid, responsive design driven by content rather than device breakpoints, cascade layers and specificity discipline, custom properties as design tokens, dark mode, container queries, and avoiding forced synchronous layout. Use when building a page or component layout, when a stylesheet has become an override war, when a design needs to work across viewports and themes, or when scrolling and animation feel janky.
license: MIT
metadata:
  uad-layer: platform
  uad-platform: web
  uad-domain: graphics
  uad-version: "1.0.0"
  uad-tags: "css, flexbox, grid, responsive, container queries, cascade layers, specificity, design tokens, dark mode, layout thrash"
  uad-maturity: stable
---

# Web CSS and Layout

## Purpose

CSS problems are almost never about a missing property. They come from a layout
model chosen for the wrong job, a cascade nobody controls, breakpoints tied to
the devices of 2014, and animation of properties that force the browser to
recompute layout every frame. This skill covers the decisions that make a
stylesheet predictable, so a change in one place does not require an
`!important` somewhere else.

## When to use

- Laying out a page, a component, or a design system primitive.
- A stylesheet has reached the stage where new rules only work with
  `!important` or an ever-longer selector.
- Making an interface responsive, or fixing a layout that breaks between the
  breakpoints that were tested.
- Introducing design tokens, theming, or dark mode.
- A component needs to adapt to the space it is placed in rather than the
  viewport.
- Scrolling, resizing or an animation stutters and the profile shows layout or
  style recalculation.

## When NOT to use

- For component boundaries, folder structure and where state lives, use
  `web-frontend-architecture`.
- For semantics, focus order, contrast requirements and assistive technology,
  use `web-accessibility`. Layout decisions affect all of those, but the
  requirements live there.
- For bundle size, image formats, font loading budgets and Core Web Vitals
  measurement, use `web-performance`.
- For framework-specific styling APIs, use the framework skill; the layout
  model below is identical regardless of how the class ends up on the element.

## Required context

- **Styling approach in use**: plain CSS or CSS Modules, Tailwind, a
  CSS-in-JS library, Sass, or a component library's theme system. Check
  `package.json`, `tailwind.config.*`, `postcss.config.*` and any
  `*.module.css` files. Mixing approaches without a rule for which wins
  produces the override war.
- **Existing token layer**: CSS custom properties in `:root`, a Tailwind theme
  block, or a design-tokens JSON. Find it before inventing a new colour.
- **Browser support target**: `browserslist` in `package.json` or
  `.browserslistrc`, plus any `autoprefixer` or `lightningcss` configuration.
  This decides whether container queries, `:has()`, `light-dark()` and nesting
  can be used unguarded.
- **Reset or normalize** already applied, and whether `box-sizing: border-box`
  is set globally. Half of "unexplained" spacing bugs are its absence.
- **Whether the app server-renders.** Styling that depends on JavaScript
  measuring the DOM produces a flash of unstyled or mispositioned content on
  first paint.

## Version constraints

CSS features ship per browser, not per package, so the constraint is the
support target rather than a dependency version. Read `browserslist` first, then
check the specific features against Baseline.

- **Container queries** (`container-type`, `@container`) and **`:has()`** are
  Baseline widely available, but a project supporting older embedded webviews
  still needs a fallback path.
- **Cascade layers** (`@layer`) are widely supported; a stylesheet that relies
  on them degrades badly where they are not, because unlayered styles win over
  every layer.
- **Native CSS nesting** and the **`&` selector** shipped later than the
  preprocessor syntax they resemble, and early implementations differed on
  bare element selectors. Verify before removing Sass.
- **`light-dark()`** and `color-scheme` simplify theming but are newer than the
  media-query approach; the media query works everywhere.
- **Tailwind 3 to 4** is a genuine break: v4 moved configuration into CSS with
  `@theme` and `@import "tailwindcss"`, replaced the JS config as the primary
  mechanism, and raised the browser floor. Tailwind examples from v3 do not
  apply to a v4 install. Read the installed version from the lockfile.
- **Sass** deprecated `@import` in favour of `@use` and `@forward`, and legacy
  division. Old tutorials produce deprecation-warning noise or errors.

## Workflow

1. **Choose the layout model by dimensionality, not by habit.** One axis with
   content-driven sizes, a toolbar, a row of tags, a stack, is flexbox. Two
   axes with an explicit structure, page shells, card grids, form layouts with
   aligned labels, is grid. A grid item can be a flex container; they compose.
2. **Let content define breakpoints.** Resize until the layout looks wrong,
   then add a breakpoint there. Naming breakpoints after phones and tablets
   guarantees a broken layout on the next popular size. Prefer intrinsic
   responsiveness first: `grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr))`
   and `clamp()` for fluid type and spacing remove entire breakpoints.
3. **Use container queries for reusable components.** A card that is wide in a
   main column and narrow in a sidebar cannot be styled by viewport width. Set
   `container-type: inline-size` on the wrapper and query it with `@container`,
   so the component is correct wherever it is placed.
4. **Establish cascade layers up front.** Declare the order once, for example
   `@layer reset, base, tokens, layout, components, utilities;`, and put every
   rule in a layer. Later layers win regardless of specificity, so a utility no
   longer needs `!important` to beat a component rule. Remember that any
   unlayered CSS outranks all layers.
5. **Keep specificity flat.** Target a single class. Use `:where()` (zero
   specificity) for reset and defaults, and `:is()` to group selectors without
   the specificity of their longest branch. Never style by id or by long
   descendant chains.
6. **Define tokens as custom properties, in tiers.** Primitives
   (`--color-blue-600`, `--space-4`) feed semantic tokens
   (`--color-surface`, `--color-text-muted`, `--radius-card`), and components
   reference only the semantic tier. Theming then means reassigning a dozen
   semantic tokens, not auditing every rule.
7. **Implement dark mode by reassigning semantic tokens.** Set
   `color-scheme: light dark` so form controls and scrollbars follow, provide
   the default palette on `:root`, override it inside
   `@media (prefers-color-scheme: dark)`, and let an explicit
   `[data-theme="dark"]` attribute override both so a user toggle wins. Never
   define a colour only inside the dark block.
8. **Use logical properties** (`margin-inline`, `padding-block`,
   `inset-inline-start`) so a right-to-left locale does not need a mirrored
   stylesheet.
9. **Animate only `transform` and `opacity`.** These can be handled by the
   compositor. Animating `width`, `top`, `margin` or `box-shadow` forces layout
   or paint every frame. Reserve `will-change` for the moment before an
   animation starts and remove it after.
10. **Avoid forced synchronous layout in JavaScript.** Reading
    `offsetWidth`, `getBoundingClientRect()` or `scrollTop` after a style write
    forces the browser to lay out immediately. Batch all reads, then all
    writes, or use `ResizeObserver` and `IntersectionObserver` instead of
    measuring in a scroll handler.
11. **Respect user preferences.** Wrap non-essential motion in
    `@media (prefers-reduced-motion: reduce)` and honour
    `prefers-contrast` where the design allows.

## Best practices

- Set `box-sizing: border-box` globally, and `min-width: 0` on flex and grid
  items that contain text or overflow containers; the default `auto` minimum
  size is the cause of most "my flex item will not shrink" bugs.
- Use `gap` for spacing between siblings rather than margins on children.
  It does not collapse, needs no last-child exception, and works in both
  flex and grid.
- Prefer `grid-template-areas` for page shells: the CSS becomes a readable
  picture of the layout and rearranging at a breakpoint is one redeclaration.
- Use `dvh`/`svh`/`lvh` rather than `vh` for full-height mobile layouts, where
  the browser chrome changes the viewport during scroll.
- Constrain line length with `max-width` in `ch` units for readability rather
  than pixel widths that assume a font size.
- Give media intrinsic dimensions (`width`/`height` attributes or
  `aspect-ratio`) so space is reserved before load and layout does not shift.
- Scope component styles (CSS Modules, a naming convention, or shadow DOM) so
  a class name cannot collide with another team's.
- Keep the number of distinct spacing, radius and shadow values small. A scale
  of six values looks deliberate; twenty ad-hoc values looks broken.
- Test at 200% and 400% browser zoom and with a long-word locale, not just at
  design widths.

## Common mistakes

- **Absolute positioning to fix an alignment problem.** It removes the element
  from flow, so nothing around it responds to its size, and it breaks the
  moment content grows.
- **Fixed pixel heights on text containers.** Translation, larger user font
  sizes and long words all overflow. Use `min-height` and let content grow.
- **Device-named breakpoints.** `@media (max-width: 768px)` encodes an
  assumption about hardware that was never true and is now false.
- **Escalating specificity to win.** Each override makes the next one harder;
  the endpoint is `!important` on everything and a stylesheet nobody can
  change. Fix the layer or the selector instead.
- **Viewport media queries for component-level decisions.** The component
  breaks when reused in a narrower container. Use container queries.
- **Hard-coded colours next to a token system.** The one hard-coded value is
  the one that stays light in dark mode.
- **`will-change` applied permanently**, promoting layers that consume memory
  and can make rendering slower than the animation it was meant to help.
- **Measuring in a scroll or resize handler.** Forced layout on every event
  produces exactly the jank being investigated. Use observers.
- **`overflow: hidden` to hide a layout bug.** The content is still there,
  now unreachable by keyboard and invisible to the user who needed it.
- **Nesting five levels deep** in a preprocessor, which compiles to selectors
  with specificity nobody intended.

## Validation

- Run `npx stylelint "**/*.css"` with `stylelint-config-standard` and, if
  useful, a `max-nesting-depth` and `selector-max-specificity` rule. Passing is
  zero errors.
- Check the support target: `npx browserslist` prints the resolved browser
  list, and features used must be supported by every entry or guarded with
  `@supports`.
- In Chrome DevTools, run the Rendering panel with "Paint flashing" and
  "Layout Shift Regions" enabled while interacting. Passing means no
  full-screen repaints on hover or scroll and no shift regions after load.
- Record a Performance profile while scrolling. Passing means no "Forced
  reflow" warnings and no long purple Layout blocks tied to a scroll handler.
- Resize the window continuously from 320px to 2560px. Passing means no
  horizontal scrollbar appears and no element overflows its container at any
  width.
- Toggle "Emulate prefers-color-scheme: dark" and confirm every surface,
  border and icon changes. Any element that stays light is a hard-coded colour.
- Set the browser's default font size to 24px and reload. Passing means the
  layout reflows rather than clipping, which is what `rem`-based sizing buys.

## References

- [MDN CSS grid layout guide](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_grid_layout)
- [MDN CSS flexible box layout guide](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_flexible_box_layout)
- [MDN container queries](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_containment/Container_queries)
- [MDN cascade layers](https://developer.mozilla.org/en-US/docs/Web/CSS/@layer)
- [web.dev Baseline](https://web.dev/baseline)
- [web.dev, avoid large, complex layouts and layout thrashing](https://web.dev/articles/avoid-large-complex-layouts-and-layout-thrashing)
