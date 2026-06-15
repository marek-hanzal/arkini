# Add save/config version reset

Status: TODO

## Goal

Stop old incompatible saves from causing startup loops, broken migrations, or undead runtime states.

The game does not promise backwards compatibility for dev saves. If migrations cannot safely support a save/config version, drop and rebuild the save.

## Current state

- GAME.MD allows dropping incompatible saves after migrations.
- Root error boundary has a hard reset path for OPFS storage.
- Multiple structural migrations now exist: item instances, activation inputs, craft inputs.
- There is no final strict config/schema version gate yet.

## Proposed work

- Add a canonical save/schema/config version constant.
- Store the version in save metadata or a small local metadata table.
- On boot:
  1. run migrations
  2. compare stored version with active version
  3. if incompatible, delete current save data and seed a fresh default state
  4. never loop forever on failed startup
- Document the policy in README and GAME.MD if needed.

## Acceptance

- Starting with an incompatible save produces a clean fresh save, not a broken screen.
- The reset path is explicit and easy to find.
- Runtime tables do not contain stale old shapes after reset.
- Typecheck and build pass.

## Watchouts

- Do not attempt heroic backwards compatibility unless explicitly requested.
- Keep reset scoped to game save data when possible; full OPFS wipe should stay a recovery option, not the normal path.
