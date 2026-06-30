# Effect stability pass

- Craft start gates now treat `grant.blockStart` as a first-class runtime blocker, not just an action-start rejection. `readCraftLineEffectState` exposes `startGateReady = grantsReady && !blocked` for realtime craft sync.
- Running craft jobs pause/resume when active effect grants/blockers change, matching producer job start-gate behavior.
- Runtime craft views expose `effectBlocked` and `effectBlockReasons`; craft action/state UI must use those fields instead of guessing from local inputs.
- Product-line effect readiness is named `startRequirementsReady`; it includes start-phase grant and nearby requirements, so do not call it `grantsReady` in producer runtime code.
- Config audit terminal-item warnings must count line-owned effect selectors as item usage. Items that exist only as nearby effect anchors are not terminal dead ends.
