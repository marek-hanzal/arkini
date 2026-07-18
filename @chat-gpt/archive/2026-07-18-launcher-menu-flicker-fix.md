# Launcher and game-menu flicker fix

## Problem

The launcher splash leaked the already-mounted main menu through its first transparent frame, then both launcher and game-menu animations called `cancel()` after `finished`, restoring their fully visible CSS base for a React frame before unmount. Splash Escape during enter was queued rather than interrupting the active animation, the requested 2.5-second durations were absent, and the startup handoff explicitly disabled TanStack native View Transitions.

## Resolution

- Splash enter and exit are both 2.5 seconds.
- A black underlay remains beneath the transparent enter frame, then disappears only after the splash is fully open.
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
- 20 focused launcher, router, game-menu, and shell tests passed; additional regression assertions cover 2.5-second durations, hidden first frames, committed final frames, immediate Escape reversal, and the named main-menu transition.

Native macOS visual smoke remains required because one-frame compositor defects cannot be proven by jsdom.
