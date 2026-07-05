# Splash to board crossfade pass

Implemented a splash-to-board crossfade for the app boot gate.

## Changes

- Added a `visible -> fading -> hidden` splash phase in `AppSplashGate`.
- Added `APP_SPLASH_FADE_DURATION_MS = 1500` default fade duration.
- Wrapped the board children in `AppSplashCrossfadeLayer` so the board starts hidden, fades in during the fading phase, and remains visible after the splash unmounts.
- Updated `AppSplashScreen` to fade out with the same duration.
- Added static render tests for splash fade-out and board fade-in states.

## Validation

- `npm run format:check`
- `npm run audit:current`
- `npm run audit:dupes`
- `npm run game:schema:check`
- `npm run game:validate -- game/arkini`
- `npm run dc`
- `npm run typecheck`
- `npx vitest run --no-color src/app/AppSplashScreen.test.tsx --pool=forks`
- `npm run build`

Full-suite chunking was partially attempted; the container still shows intermittent Vitest hangs before summaries on unrelated chunks, consistent with previous passes.
