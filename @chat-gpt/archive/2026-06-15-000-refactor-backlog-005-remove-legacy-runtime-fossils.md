# Remove legacy runtime fossils

Status: DONE

## Goal

Delete or reduce leftover files whose responsibility belongs to the new architecture: commands, view models, item instances, activation/craft runtime, and command visual events.

## Current state

The project still contains older areas created before the refactor, especially around `play`, `drag`, interaction glue, and visual motion staging.

Some of those files are still useful. Some are fossilized compromises wearing fresh imports.

## Proposed areas to audit

- `src/play/hook/*`
- `src/play/logic/*`
- `src/interaction/*`
- `src/drag/*`
- `src/animation/*`
- old producer-only helpers under `src/producer/*`
- board/inventory compatibility projection helpers after the item-instance model stabilizes

## Acceptance

- Every remaining file has a clear current responsibility.
- Dead helpers are deleted, not moved into a different drawer.
- No compatibility layer exists only to keep old names alive.
- README source layout reflects reality.
- Typecheck and build pass.

## Watchouts

- Do not delete generic drag workflow code until TileEngine/pointer runtime is verified.
- Do not collapse everything into one giant hook. We already tried the box-of-trash strategy. It was trash.

## Completion note

Completed in the v0 cleanup pass after the active runtime became self-contained. The pre-v0 root runtime directories and the `src/ancient` snapshot were deleted. Active source is now limited to `src/app`, `src/assets`, `src/v0`, and `src/vite-env.d.ts`.
