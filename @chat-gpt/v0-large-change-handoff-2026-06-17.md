# Large change handoff - 2026-06-17

Status: ACTIVE HANDOFF NOTE

## Snapshot

`main` and `v0` should remain aligned at this handoff checkpoint before the incoming large product change. The last code refactor checkpoint before handoff hygiene was:

```txt
fa94796 Finish domain boundary audit
```

The handoff hygiene commit itself is docs-only and may sit on top of that code checkpoint.

Do not start `009-economy-content-pass` or another broad refactor before the next large change lands. The point of this handoff is to keep the repo boring and mergeable, which is apparently still difficult enough to deserve documentation.

## Completed foundation before the handoff

- Tile animations are owned by TileEngine through WAAPI and a generic motion request registry.
- TileEngine public API is enforced through the `~/v0/tile-engine` barrel and dependency-cruiser boundaries.
- Render churn was reduced with adapter-owned `renderKey` tokens and focused TileEngine memo comparators.
- Item definitions are split by one-level content/root families while preserving `GameItemDefinitions` as the single item collection export.
- Tap/drop/cache domain decisions were pulled into focused pure helpers instead of living inside UI hooks or cache glue.
- Initial tests cover manifest validation, planning helpers, tap/drop action helpers, motion/equality helpers and boundary-sensitive helpers touched during refactors.

## Boundaries to preserve during the large change

- Keep durable board/inventory cache rows free of temporary TileEngine motion handoff data. Presence motion belongs in `TileEngineMotionRequestStore`.
- Keep TileEngine generic. It must not import Arkini manifest, board, inventory, play, activation, craft, upgrade, database or game domains.
- Import TileEngine from `~/v0/tile-engine` outside the TileEngine folder. Do not deep-import implementation files.
- Keep UI hooks as wiring/adapters. Gameplay decisions should be delegated to `logic/` helpers or `play/drop` action resolvers.
- Keep manifest config as the single static truth, composed from focused topic files under `src/v0/manifest/config`.
- Keep `npm run check`, `npm run build` and `git diff --check` green before packaging non-doc work.

## Good first step after the incoming change lands

1. Re-read `@chat-gpt/README.md`.
2. Check `git status --short --branch` and verify `.git` exists.
3. Compare the incoming product change against the boundaries above.
4. Only then choose whether to resume `009-economy-content-pass`, extend tests, or fix conflicts introduced by the new change.

