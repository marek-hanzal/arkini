# TanStack Router native View Transitions

Issue: #268

## Decision

- Enable TanStack Router `defaultViewTransition: true` in the canonical `createArkiniRouter` configuration.
- Keep the experiment entirely native and global.
- Do not add route-specific transition types, `view-transition-name`, React animation state, engine coupling, timers, or a project-owned transition abstraction.
- Do not add a `prefers-reduced-motion` branch. Product direction explicitly treats route motion as part of the game experience.

## Verification

- canonical router uses `document.startViewTransition` when the API exists;
- unsupported browsers execute the navigation update normally;
- launcher direct-load and redirect behavior remains covered;
- GameOwner replacement/release behavior remains covered independently and is not changed by transition snapshots.

The visual value remains deliberately experimental: keep the native default while it improves route changes without lifecycle regressions; custom styling requires a separate justified task.
