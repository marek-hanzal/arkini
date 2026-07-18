# Launcher and game-menu flicker fix

## Problem

The launcher splash leaked the already-mounted main menu through its first transparent frame, then both launcher and game-menu animations called `cancel()` after `finished`, restoring their fully visible CSS base for a React frame before unmount. Splash Escape during enter was queued rather than interrupting the active animation, the requested 2.5-second durations were absent, and the startup handoff explicitly disabled TanStack native View Transitions. The first fix hid the leak behind a temporary black underlay, but that still left the main menu fully rendered beneath the complete enter lifecycle and did not establish a real inverse-opacity contract.

## Resolution

- Splash enter and exit are both 2.5 seconds.
- The startup page owns a black base and holds its already-mounted main-menu wrapper at opacity zero through black hold, splash enter, and splash open. The former temporary black underlay is gone.
- Splash exit starts two synchronized WAAPI animations with the same duration and easing: splash opacity moves toward zero while main-menu opacity moves from zero to one. Both final frames are committed before the route handoff.
- Splash Escape after authoritative startup readiness switches `entering -> exiting` immediately and reuses the computed current frame.
- WAAPI final frames are persisted with `Animation.commitStyles()` before `cancel()`; browsers without `commitStyles()` retain the filled animation until unmount.
- Game-menu backdrop and dialog start from explicit hidden inline frames before the first paint and persist the final exit frame before provider unmount.
- Startup navigation no longer opts out of TanStack View Transitions. The main-menu scene owns a stable `view-transition-name` so the old mounted menu and route destination are paired as one shared snapshot.

## Validation

- `npm run format:check`
- `npm run typecheck`
- `npm run game:validate`
- `npm run dc`
- `npm run build`
- 17 focused launcher, router, and game-menu tests passed; regression assertions cover 2.5-second durations, hidden first frames, the main menu remaining opacity-zero before exit, inverse exit keyframes, committed final frames, immediate Escape reversal, and the named main-menu transition.

Native macOS visual smoke remains required because one-frame compositor defects cannot be proven by jsdom.
