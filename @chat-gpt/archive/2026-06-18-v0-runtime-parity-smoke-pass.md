# v0 runtime parity smoke pass

Status: DONE
Date: 2026-06-18

## Goal

Tighten the live browser runtime after the Dexie/runtime-store/producer-queue migration. The pass focused on places where UI state could drift from engine time/state even though the save model was technically correct. In other words: stop the game looking haunted while the types smugly say everything is fine.

## Result

- Added `useLiveNowMs` as the shared small clock hook for UI surfaces that need live countdown/progress updates without forcing engine revisions every 250ms.
- Refactored `useProducerClock` onto `useLiveNowMs`, keeping the existing 250ms live clock behavior but moving the generic timer out of producer-specific code.
- Fixed `useGameRuntimeSelector` caching so selectors that depend on external props/time can recompute even when the runtime root snapshot did not change. The old cache keyed only by root state and could return stale selected values for time-driven selectors.
- Item sheet craft progress now uses `readLiveCraftView`, matching board tiles instead of showing a frozen snapshot until the next runtime revision.
- Item sheet product line progress now uses `readLiveProducerProductLineView`, so product progress bars update from live time while queued/running jobs wait for the engine tick.
- Upgrade sheet progress now runs from a live clock based on current upgrade job completion times and passes that clock into `readRuntimeUpgradeListViewFromGameSave`.
- Dev sheet `Next tick` countdown now uses the same live clock instead of formatting with `Date.now()` only when some unrelated render happens.
- Debounced Dexie persistence now flushes on `pagehide` and when the document becomes hidden, in addition to flushing on runtime destroy. This improves reload/tab-close survival for dev scenario loads and quick user actions while keeping storage outside the engine.
- Blocked scheduled events no longer keep `dueAtMs` in the past. A blocked spawn is retried after `blockedScheduledEventRetryDelayMs` and still emits the blocked event only once, preventing the auto ticker from entering a 0ms retry loop.

## Tests added / updated

- Added `readLiveProducerProductLineView` tests for live progress recompute, clamping and idle pass-through.
- Updated scheduled event tests to assert blocked events are rescheduled to the retry delay and still do not spam blocked events on retry.

## Watchouts

- `useGameRuntimeSelector` still intentionally reuses the previous selected value when `isEqual(previous, next)` returns true. If a selector depends on external inputs, either pass those inputs through a changing selector closure or build a specific hook around it.
- The blocked scheduled event retry delay is currently fixed at 1000ms. This is good enough to avoid a hot loop, but later gameplay may want policy per scheduled event type.
- Page lifecycle persistence flush is best-effort. IndexedDB writes during tab close are still browser-dependent, because browsers are tiny lawless kingdoms wearing standards as hats.
