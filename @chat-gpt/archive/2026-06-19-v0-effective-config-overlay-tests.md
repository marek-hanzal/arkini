# v0 effective config overlay tests

Date: 2026-06-19
Commit scope: test-only hardening for the JSON config/effective config overlay path.

## Context

The older architecture review said the JSON config/effective config layer still needed hardening. Current source is newer than that note: runtime now reads the compiled JSON config through `defaultGameConfig`, `GameConfigSchema` already validates inputRef ownership/effective inputRef prefixes, and zero/negative effective upgrade results are rejected at schema level.

Because that area already carries deliberate design decisions, this pass intentionally avoided production code changes. The goal was to preserve the current behavior and lock the important contracts with tests instead of doing heroic refactor theater in a part of the code that is no longer the problem.

## Added coverage

### `GameConfigSchema.test.ts`

Added a negative schema test proving that after a `product.inputRef.set` effect in an upgrade prefix, a later `product.input.quantity.add` effect is validated against the new effective input ref, not the product's earlier input ref.

This protects the important rule: upgrade validation follows the same ordered/effective interpretation as runtime config layering.

### `buildGameConfigServiceFx.test.ts`

Added tests for the runtime effective config service:

- Completed upgrades alter `service.config` while `service.baseConfig` and the original parsed config stay unchanged.
- Rebuilding the service from the same base config/save does not accumulate duration deltas.
- `product.inputRef.set` followed by `product.input.quantity.add` applies to the selected effective input ref.
- Quantity upgrades are scoped by the owning effective input ref, even when another separate product input accepts the same item.

## Notes for future work

Do not treat shared `inputRefId` as a runtime repair problem. Source config/schema validation owns that invariant. Runtime should consume valid config and save states, not silently compensate for invalid authoring data like a sad babysitter with a compiler.

If this area is touched again, prefer adding small tests around `GameConfigSchema` and `buildGameConfigServiceFx` before modifying production logic. The existing overlay model is intentional: base config is immutable source truth; completed upgrades produce an effective layer for engine Fx.
