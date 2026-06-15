# v0 hard audit

Status: DONE
Commit: TBD
Date: 2026-06-16

## Scope

Audit the post-legacy-prune `src/v0` tree for architectural drift before continuing gameplay work.

Focus areas:

- active code must not import removed pre-v0 runtime domains
- React Query rules must still hold: `useSuspenseQuery`, no `useQuery`, no `getQueryData`
- no custom React context/provider in app/v0
- no centralized game/session hooks returning a bag of callbacks
- Effect dependencies must not be manually faked
- domain types/schemas should stay standalone instead of collecting in shared type piles
- deletion of legacy/ancient code must not have dropped referenced assets or active imports

## Findings

The active tree is still clean from legacy imports. `src/v0` imports only `~/v0/*` and `~/assets/*`, and `src/app` points at the v0 runtime.

The previous `runEffect` implementation had a suspicious generic `R extends GameRuntimeServiceFx` followed by a cast to `Effect.Effect<T, E, never>`. That cast made the runner look more precisely typed than it was. The runner now accepts a concrete game-runtime Effect and relies on the actual `provideService` chain to erase the runtime dependency channel. No `as Effect.Effect<..., never>` cast remains.

The game action mutation hooks now type their React Query error channel as `GameActionError` instead of `unknown`. Runtime Promise rejection cannot encode TypeScript failure channels, because JavaScript remains JavaScript, the tiny lawless village. But the UI-facing mutation contract now documents the tagged gameplay error that Fx roots emit.

`inventory/logic/planning/types.ts` was a mixed type bucket. It has been split into owner-domain model files:

- `play/save/model/SaveShape.ts`
- `board/model/BoardRow.ts`
- `inventory/model/InventoryRow.ts`
- `placement/model/PlacementPlan.ts`
- `placement/model/InventoryPlacementPlan.ts`

`manifest/producer.ts` and `manifest/upgrade.ts` were also mixed definition buckets. They are split into standalone manifest definition files under:

- `manifest/activation/*`
- `manifest/upgrade/*`

`RandomServiceFx.ts` no longer contains random helper types directly. The service contract now lives in `RandomService.ts`, weighted entry shape in `WeightedRandomEntry.ts`, and the Effect tag stays in `RandomServiceFx.ts`.

## Verification

Commands run successfully:

```bash
npm run format:check
npm run typecheck
npm run build
git diff --check
```

Additional checks:

```bash
rg -F "useQuery(" src/v0 src/app
rg -F "getQueryData" src/v0 src/app
rg -F "switch (" src/v0 src/app
rg -F "createContext" src/v0 src/app
rg -F ".Provider" src/v0 src/app
rg "from ['\"]~/" src/v0 | grep -v "~/v0/" | grep -v "~/assets/"
```

All remained clean.

Asset manifest check:

- 39 referenced PNG filenames in `src/v0/manifest/config/asset/*`
- 39 matching files in `src/assets`
- no missing asset files
- no extra PNG files outside the manifest

Generated declaration audit confirms v0 Fx roots infer their own context requirements. The only game-runtime boundary is `runEffect`/`runGameFx`, which deliberately provides the complete runtime service set.

## Watchlist

`BoardSurface` and `InventorySurface` still do local wiring for TileEngine props, actions, and read models. That is acceptable for now because they are concrete domain surfaces, not root mega-hooks. If either grows further, split by component/adapter files rather than inventing a new `useSurfaceRuntime` sack of callbacks.

`manifest/manifestId.ts` remains one typed-ID file. That is deliberate for now because IDs are one manifest-wide contract. Splitting it can wait until there is a real owner distinction instead of a purity ritual with no payoff.
