# 2026-06-30 Effect placement reason review

Deep review pass after the effect/grant migration, focused on board/inventory placement classification and effect-source lifecycle.

## Fixed

Board placement effect failure classification used `some(missingGrant)` in multiple paths. That reported `effect:missing-grant` whenever any candidate cell missed a required grant, even if another candidate cell had the grant and was blocked by `item.blockCreate`.

Correct rule: report `effect:missing-grant` only when every candidate board cell misses required grants. If at least one candidate has grants but no placement is allowed, report `effect:block-create`.

Centralized the classification in `readBoardItemCreateEffectFailureReason` and reused it from debug board spawn, inventory-to-board readiness, and generic board-first output placement.

## Verified non-change

Active effects keep their own runtime source id separate from `sourceItemInstanceId`. Do not collapse those identities. Active effect instances can intentionally keep blocking/granting while linked jobs are active, even when passive-source ignore logic would ignore the board item instance during replacement checks.
