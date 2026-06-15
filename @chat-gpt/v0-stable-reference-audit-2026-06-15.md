# v0 stable reference audit

Status: DONE

## Context

The active v0 runtime is optimistic-first and animation-first. Tile actors must not lose drag state just because React re-rendered after a query cache patch, feedback pulse, or clock tick. React memo hooks are only useful when their inputs are stable; otherwise they are decorative bullshit with extra ceremony.

## Changes

- Added `src/v0/tile-engine/useLatestRef.ts` for engine-local latest value refs.
- Changed tile-engine pointer/tap/drag hooks to read dynamic `drag`, `tile`, `binding`, and `disabled` data from latest refs.
- Kept pointer handlers stable across ordinary re-renders so active drag sessions are not tied to freshly allocated config objects.
- Stabilized feedback command callbacks. `Feedback` now depends on the stable `pulse` callback, not the whole feedback flag object.
- Split feedback rendering state from feedback command API. Surfaces receive the changing `feedbackFlags` set for visuals, while drag/drop config does not depend on that set.
- Verified active v0 still avoids `useQuery`, `getQueryData`, custom app contexts, and `switch`.

## Architectural note

React Query remains the durable read/reference owner for board, inventory, item, upgrade, database, and save data. Local UI state is still allowed for transient feedback and pointer state, but dynamic values crossing into long-lived pointer handlers must be read through refs instead of being captured by fragile callback closures.
