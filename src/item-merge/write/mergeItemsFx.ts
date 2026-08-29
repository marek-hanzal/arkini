import { Effect, Option, Random } from "effect";

import { GameEventEnumSchema } from "~/game-event/schema/GameEventEnumSchema";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { ItemMergedGameEventSchema } from "~/game-event/schema/ItemMergedGameEventSchema";
import { ItemNotOnBoardError } from "~/engine/item/error/ItemNotOnBoardError";
import { ItemNotOnGridError } from "~/engine/item/error/ItemNotOnGridError";
import { MergeSameItemError } from "~/item-merge/error/MergeSameItemError";
import { applyMergeRuntimeFx } from "~/item-merge/fx/applyMergeRuntimeFx";
import { resolveMergeRuleFx } from "~/item-merge/fx/resolveMergeRuleFx";
import type { MergeSchema } from "~/item-merge/schema/MergeSchema";
import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";
import { assertRevisionFx } from "~/engine/revision/fx/assertRevisionFx";
import type { RevisionSchema } from "~/engine/revision/schema/RevisionSchema";
import { modifyRuntimeFx } from "~/engine/runtime/internal/modifyRuntimeFx";
import { isBoardRuntimeItemFn } from "~/engine/runtime/read/fn/isBoardRuntimeItemFn";
import { isGridRuntimeItemFn } from "~/engine/runtime/read/fn/isGridRuntimeItemFn";
import { readRuntimeItemByIdFx } from "~/engine/runtime/read/readRuntimeItemByIdFx";
import type { GridRuntimeItemSchema } from "~/engine/runtime/schema/GridRuntimeItemSchema";
import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";
import { CrossSpaceBoardOperationError } from "~/item-location/error/CrossSpaceBoardOperationError";
import { TargetEffectSchema } from "~/item-merge/schema/TargetEffectSchema";

/** Bump only when intentionally changing directional-merge random compatibility. */
const MergeRandomVersion = 2;

const readRemainingChargesSeedFn = (item: RuntimeItemSchema.Type) => {
	return item.remainingCharges ?? item.item.charges?.amount ?? "full";
};

const makeMergeRandomFx = Effect.fn("makeMergeRandomFx")(function* <Result, Error, Requirements>({
	program,
	rule,
	ruleIndex,
	source,
	target,
}: {
	readonly program: Effect.Effect<Result, Error, Requirements>;
	readonly rule: MergeSchema.Type;
	readonly ruleIndex: number;
	readonly source: RuntimeItemSchema.Type;
	readonly target: RuntimeItemSchema.Type;
}) {
	const result = rule.effect === TargetEffectSchema.enum.Replace ? rule.result : "none";

	return yield* program.pipe(
		Random.withSeed(
			[
				"arkini:merge",
				`v${MergeRandomVersion}`,
				source.id,
				source.item.id,
				source.quantity,
				readRemainingChargesSeedFn(source),
				target.id,
				target.item.id,
				target.quantity,
				readRemainingChargesSeedFn(target),
				ruleIndex,
				rule.action,
				rule.effect,
				result,
			].join(":"),
		),
	);
});

interface MergeItemsProps {
	readonly sourceItemId: IdSchema.Type;
	readonly sourceRevision: RevisionSchema.Type;
	readonly targetItemId: IdSchema.Type;
	readonly targetRevision: RevisionSchema.Type;
}

interface MergeItemsResult {
	readonly event: ItemMergedGameEventSchema.Type;
	readonly sourceBefore: GridRuntimeItemSchema.Type;
	readonly targetBefore: GridRuntimeItemSchema.Type;
	readonly sourceAfter?: GridRuntimeItemSchema.Type;
	readonly targetAfter?: GridRuntimeItemSchema.Type;
}

/** Commits one directional merge and returns exact before/after actor identities. */
export const mergeItemsFx = Effect.fn("mergeItemsFx")(function* ({
	sourceItemId,
	sourceRevision,
	targetItemId,
	targetRevision,
}: MergeItemsProps) {
	if (sourceItemId === targetItemId) {
		return yield* Effect.fail(
			new MergeSameItemError({
				itemId: sourceItemId,
			}),
		);
	}

	return yield* modifyRuntimeFx((runtime) =>
		Effect.gen(function* () {
			const runtimeSource = yield* readRuntimeItemByIdFx({
				itemId: sourceItemId,
				runtime,
			});
			const runtimeTarget = yield* readRuntimeItemByIdFx({
				itemId: targetItemId,
				runtime,
			});
			yield* assertRevisionFx({
				actualRevision: runtimeSource.revision,
				entityId: runtimeSource.id,
				expectedRevision: sourceRevision,
			});
			yield* assertRevisionFx({
				actualRevision: runtimeTarget.revision,
				entityId: runtimeTarget.id,
				expectedRevision: targetRevision,
			});
			const source = Option.getOrUndefined(isGridRuntimeItemFn(runtimeSource));
			if (source === undefined) {
				return yield* Effect.fail(
					new ItemNotOnGridError({
						itemId: runtimeSource.id,
						location: runtimeSource.location,
					}),
				);
			}
			const target = Option.getOrUndefined(isBoardRuntimeItemFn(runtimeTarget));
			if (target === undefined) {
				return yield* Effect.fail(
					new ItemNotOnBoardError({
						itemId: runtimeTarget.id,
						location: runtimeTarget.location,
					}),
				);
			}
			const boardSource = Option.getOrUndefined(isBoardRuntimeItemFn(source));
			if (boardSource !== undefined && boardSource.location.space !== target.location.space) {
				return yield* Effect.fail(
					new CrossSpaceBoardOperationError({
						fromSpace: boardSource.location.space,
						toSpace: target.location.space,
					}),
				);
			}

			const resolved = yield* resolveMergeRuleFx({
				source,
				target,
			});
			const mergeTransition = yield* makeMergeRandomFx({
				program: applyMergeRuntimeFx({
					rule: resolved.rule,
					runtime,
					source,
					target,
				}),
				rule: resolved.rule,
				ruleIndex: resolved.index,
				source,
				target,
			});
			const nextRuntime = mergeTransition.runtime;
			const event = {
				type: GameEventEnumSchema.enum.ItemMerged,
				sourceItemId: source.id,
				sourceCanonicalItemId: source.item.id,
				targetItemId: target.id,
				targetCanonicalItemId: target.item.id,
				action: resolved.rule.action,
				effect: resolved.rule.effect,
				resultCanonicalItemId:
					resolved.rule.effect === TargetEffectSchema.enum.Replace
						? resolved.rule.result
						: undefined,
			} satisfies ItemMergedGameEventSchema.Type;
			const sourceAfter = nextRuntime.items.find(
				(item): item is GridRuntimeItemSchema.Type =>
					item.id === source.id &&
					(item.location.scope === LocationScopeEnumSchema.enum.Board ||
						item.location.scope === LocationScopeEnumSchema.enum.Inventory ||
						item.location.scope === LocationScopeEnumSchema.enum.Toolbar),
			);
			const targetAfter = nextRuntime.items.find(
				(item): item is GridRuntimeItemSchema.Type =>
					item.id === target.id &&
					(item.location.scope === LocationScopeEnumSchema.enum.Board ||
						item.location.scope === LocationScopeEnumSchema.enum.Inventory ||
						item.location.scope === LocationScopeEnumSchema.enum.Toolbar),
			);
			const result = {
				event,
				sourceBefore: source,
				targetBefore: target,
				...(sourceAfter === undefined
					? {}
					: {
							sourceAfter,
						}),
				...(targetAfter === undefined
					? {}
					: {
							targetAfter,
						}),
			} satisfies MergeItemsResult;

			return [
				result,
				nextRuntime,
				[
					event,
					...mergeTransition.events,
				],
			] as const;
		}),
	);
});
