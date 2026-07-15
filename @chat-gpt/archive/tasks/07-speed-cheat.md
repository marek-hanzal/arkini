# 07 — Speed cheat

**Status:** Done

## Implemented contract

The loaded runtime owns one engine-visible ephemeral root value:

```text
runtime.session.speedMode
→ normal | accelerated
```

It is not gameplay save state. `StateSchema` omits it and every newly loaded session starts in `normal`.

`toggleSpeedModeFx()`:

- requires no item identity or revision;
- first folds newly elapsed wall time under the current mode;
- atomically toggles root runtime session state;
- emits `speed-mode:changed`;
- does not rewrite jobs, temporary items, durations, timestamps, or item records.

The Tick adapter scales only newly observed wall-clock deltas:

```text
normal      → 1× simulation time
accelerated → 30× simulation time
```

Both modes feed the same 200 ms fixed-step engine. Explicit `runTickRuntimeByFx` input is already simulation time and remains unscaled.

The authored speed-cheat item is only a user-facing control and visual projection. Its first asset represents accelerated mode and its second asset represents normal mode; the item is not the source or prerequisite of the global mode.

## Verification

Permanent tests cover:

- normal → accelerated → normal transitions without a cheat item;
- committed root event emission;
- unchanged active jobs and temporary runtime state;
- equivalent normal and accelerated elapsed budgets;
- no retroactive acceleration of pending normal time;
- explicit simulation advancement bypassing the multiplier;
- save omission and normal-mode session recreation.

## Historical cleanup

Historical timestamp retiming and item-owned speed truth are superseded. `src/v0/cheat/README.md` retains only board-control, asset, and audio intent for tasks 13 and 15; dependency-safe source deletion remains task 17 work.
