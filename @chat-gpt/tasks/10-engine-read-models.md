# 10 — Engine-owned decisions and live bridge projections

**Status:** In progress

## Goal

Expose only the concrete reads required by each renderer slice. Gameplay decisions remain engine-owned; `src/bridge/<domain>/<operation>` synchronously projects the latest canonical runtime for UI without caching or mirroring it.

## Dependency

Core gameplay lifecycles are implemented. UI and bridge work now proceed as vertical slices rather than a speculative read-model phase.

## Accepted bridge boundary

```text
src/ui/<domain>
→ src/bridge/<same concrete domain>
→ public src/engine domains
```

- UI may never import `src/engine` directly.
- Bridge domains may never import UI, pages, routes, or `src/engine/**/internal`.
- Bridge structure stays shallow: `src/bridge/<domain>/<operation>.ts[x]`.
- A bridge hook reads through `useSyncExternalStore` from the live `Game`; it never owns a second runtime, reducer, cache, or event reconstruction.
- `app` is reserved for genuinely application-wide Electron/router concerns. A loaded engine/session/resources root is named `Game`, not “application”.

## Implemented first slice

- `/game` loads the canonical compressed Arkini pack through `bridge/game/createGameFx`;
- the shell owns one replaceable `Game` and remounts its subtree by `instanceKey`;
- `bridge/runtime/useRuntimeSelector` is the one live React subscription pipe;
- `bridge/board/useBoard` projects current-space board items and resources from that exact snapshot;
- `ui/board/Board` and `BoardTile` render the projection;
- `ui/tile` is headless and owns only DOM registration and transient pointer state;
- revision change, unmount, or complete game replacement cancels tile-local transient state by construction.

## Candidate later surfaces

- inventory item presentation facts;
- line visibility, run/queue/blocked status, progress, and missing inputs;
- charge readiness facts: payer kind, payer runtime ID, required, available, missing, and reason;
- queue facts required to present blocked FIFO work and clear-all-pending without implying active-job cancellation;
- item target/max-count facts;
- input slot state and accepted quantity;
- job/reservation state;
- root speed mode and ordered speed-cheat asset projection;
- structured blocked reasons where product needs them.

## Do not port

- previous/current save diffing as gameplay interpretation;
- UI selectors that recompute gameplay eligibility;
- one giant universal view model;
- a DTO family mirroring every runtime schema;
- cached bridge models treated as authoritative state;
- abstract `application`, `service`, `manager`, or deep filesystem domains hiding concrete ownership.

## Acceptance criteria

- every gameplay boolean is decided by public engine logic;
- bridge projections read one current canonical snapshot and never mutate or catch up time;
- UI receives enough facts to present the concrete slice without importing engine modules;
- public surfaces are coherent by use case, not one method per field;
- raw runtime facts may pass through where presentation-only projection is sufficient;
- the bridge remains a live pipe, not a second engine.

## Required tests

- read/write agreement for line start and blocked reasons when those slices arrive;
- read behavior across Tick boundaries;
- queue, reservation, inventory pause, and special-item states;
- no mutation during reads;
- architecture guards for `ui → bridge → engine`, shallow bridge domains, and no UI runtime mirror.

## Historical cleanup on closeout

Delete historical bridge/view computations only after their information requirements are represented by current engine decisions and live bridge projections. Leave animation/audio behavior for tasks 14–15.
