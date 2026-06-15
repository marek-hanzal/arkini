# XState removal / state ownership audit

## Verdict

XState did not carry its weight in the current Arkini client. Every remaining machine was UI-local ceremony rather than a real domain workflow:

- Drag workflow phase labels were sent, but no UI or domain code read them.
- Delayed merge hint was a single timeout.
- Hard reset was one async action with pending/error UI.
- TileEngine motion registry was a map plus nonce counter.

Those are not statechart problems. Keeping XState made the code wider, hid simple transitions behind actor vocabulary, and encouraged giant wiring hooks to shuttle events through places that did not need to know about them. Tiny state deserves tiny code. Shocking, I know.

## New ownership rule

Arkini now has three state buckets:

1. SQLite owns durable game state.
2. React Query owns stable cached read models and command mutation lifecycle.
3. Local React hooks/reducers own ephemeral UI state such as timers, sheet state, feedback pulses, drag visibility, and motion registries.

A new statechart-like abstraction is allowed only when the workflow has meaningful branching, cancellation, retry, and states that multiple consumers actually need to observe. If a transition exists only so we can admire a diagram, it goes in the bin.

## What changed

- Removed `xstate` and `@xstate/react` from dependencies.
- Replaced TileEngine XState motion registry with `tileEngineMotionRegistry`, a reducer with `stage`, `settle`, and `clear` actions.
- Replaced delayed merge hint machine with a local timeout hook.
- Replaced hard reset machine with `useHardResetAction`. This one stays outside React Query because the root error boundary can render before `QueryClientProvider`; using `useMutation` there would make the crash screen depend on the thing that may not exist yet. Peak comedy avoided.
- Removed generic drag workflow machine and all no-op phase events from drag plan execution.

## Follow-up cleanup candidates

- `TileEngine.tsx` is still the biggest file. It owns pointer gesture detection, drop-target registration, slot rendering, actor motion, and Motion drag setup. That is acceptable for correctness right now because these concerns share pointer timing, but the next safe split is extracting pure pointer gesture helpers and actor props derivation without creating another god-hook circus.
- `useBoardTileEngine` and `useInventoryTileEngine` are still fat adapter hooks. They are at the usage boundary, which is better than root prop drilling, but each can be split into `useBoardTileActors`, `useBoardTileDragConfig`, and similar tiny hooks once the DnD bugs settle.
- Command execution is already the right direction: `useRunCommandMutation` owns pending/error/rollback/invalidation. Do not build extra workflow state around command calls unless UI actually renders that state.
