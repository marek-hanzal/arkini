# Launcher continue-prompt truthfulness

## Problem

`LauncherStartup.State` correctly exposed hard bootstrap readiness, but `StartupSplash` treated that state as the complete interaction contract. The prompt remained visible during `exiting`, where `requestExit` already rejected Escape, and ready-state Escape during the black hold could queue a hidden dismissal even though no prompt existed.

## Resolution

- Keep `state.type === "ready"` as hard data/bootstrap readiness.
- Derive one presentation-level `canContinue` value from hard readiness, `entering | open`, and a minimum hold that is still skippable.
- Use `canContinue` for prompt rendering and keyboard acceptance.
- Keep one broader `canExit` boundary for the shared manual/automatic exit request; the existing five-second timer only decides whether the exit is automatic or still skippable.
- Ignore Escape during black hold and loading without queueing.
- Preserve immediate reversal of an active enter after readiness.
- Hide the prompt immediately when exit starts and ignore duplicate Escape during exit.
- When hard readiness arrives after the five-second minimum, start automatic exit without rendering the prompt for an intermediate frame.

## Validation

Focused tests cover black-hold Escape, loading-state Escape, prompt appearance after readiness, prompt removal at exit start, duplicate Escape during exit, active-enter reversal, and automatic continuation.
