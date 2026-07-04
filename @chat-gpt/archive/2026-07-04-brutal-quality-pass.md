# 2026-07-04 brutal quality pass

## Scope

Deep review pass over UI/detail panels, runtime/audio/visual effects, config validation, packaged game assets, and repo audits after the limited-deposit warning work.

## Commits

- `17d24c88 Clean current audit findings`
  - removed stale exports reported by Knip.
  - extracted shared runtime drag/drop lifecycle helpers for board + inventory.
  - removed the board/inventory drag-drop audio duplicate clone.

- `6a7d9209 Remove unused packaged assets`
  - removed 21 stale PNG resources no longer referenced by `game/arkini`.
  - recompiled `game/arkini.game.arkpack`.
  - validator resource count dropped to 173.

- `eb8af9f8 Release audio resources on unmount`
  - added `GameAudioPlayer.destroy()`.
  - provider cleanup now closes the audio context and clears cooldown state.

- `330c8fda Deduplicate repeated audio batch sounds`
  - audio plan now coalesces repeated utility sounds within one runtime batch.
  - added audio plan coverage for repeated input/effect events.

- `625ac7ff Tighten line effect reachability validation`
  - line-owned effects now participate in gameplay reachability requirements.
  - `nearby.capacity.spend` is treated as a reachable board-source requirement.
  - validation now rejects capacity spend selectors that only match inventory-only items.
  - added regression tests for unreachable capacity-gated progression.

- `d8283578 Clean item detail rendering flow`
  - removed loose `filter(Boolean) as ReactNode[]` detail-section construction.
  - extracted rendered drop/output effect-line components so the UI does not recompute the same display lines twice.

## Validation notes

- `npm run audit:optional` passes: no dead exports, no clone findings.
- `npm run audit:current` passes.
- `npm run dc` passes.
- `npm run typecheck` passes.
- `npm run test` passes standalone: 101 files, 615 tests.
- `npm run game:validate -- game/arkini` passes but intentionally reports the current limited-deposit warnings for `item:double-tree`, `item:micro-forest`, `item:rock`, and `item:tree`.
- In this sandbox, the full chained `npm run check` repeatedly timed out once it entered Vitest, even though every preceding check step and the standalone Vitest run passed. Treat this as an environment/tool-runner issue unless it reproduces locally.

## Remaining known content warnings

The four `limited-deposit-softlock` warnings are expected with the current game config: finite wood/stone deposits can be consumed without sustainable replacements. They are validator warnings, not schema failures.
