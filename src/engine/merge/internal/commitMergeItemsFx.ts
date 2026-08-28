import { Effect, Option } from "effect";

import { GameEventEnumSchema } from "~/engine/event/schema/GameEventEnumSchema";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { ItemMergedGameEventSchema } from "~/engine/event/schema/ItemMergedGameEventSchema";
import { ItemNotOnBoardError } from "~/engine/item/error/ItemNotOnBoardError";
import { ItemNotOnGridError } from "~/engine/item/error/ItemNotOnGridError";
import { applyMergeRuntimeFx } from "~/engine/merge/fx/applyMergeRuntimeFx";
import { resolveMergeRuleFx } from "~/engine/merge/fx/resolveMergeRuleFx";
import { makeMergeRandomFx } from "~/engine/merge/random/makeMergeRandomFx";
import { MergeSameItemError } from "~/engine/merge/error/MergeSameItemError";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";
import { assertRevisionFx } from "~/engine/revision/fx/assertRevisionFx";
import type { RevisionSchema } from "~/engine/revision/schema/RevisionSchema";
import { modifyRuntimeFx } from "~/engine/runtime/internal/modifyRuntimeFx";
import { isBoardRuntimeItemFx } from "~/engine/runtime/read/isBoardRuntimeItemFx";
import { isGridRuntimeItemFx } from "~/engine/runtime/read/isGridRuntimeItemFx";
import { readRuntimeItemByIdFx } from "~/engine/runtime/read/readRuntimeItemByIdFx";
import type { GridRuntimeItemSchema } from "~/engine/runtime/schema/GridRuntimeItemSchema";
import { CrossSpaceBoardOperationError } from "~/engine/space/error/CrossSpaceBoardOperationError";
import { TargetEffectSchema } from "~/engine/merge/schema/TargetEffectSchema";

export namespace commitMergeItemsFx {
	export interface Props {
		readonly sourceItemId: IdSchema.Type;
		readonly sourceRevision: RevisionSchema.Type;
		readonly targetItemId: IdSchema.Type;
		readonly targetRevision: RevisionSchema.Type;
	}

	export interface Result {
		readonly event: ItemMergedGameEventSchema.Type;
		readonly sourceBefore: GridRuntimeItemSchema.Type;
		readonly targetBefore: GridRuntimeItemSchema.Type;
		readonly sourceAfter?: GridRuntimeItemSchema.Type;
		readonly targetAfter?: GridRuntimeItemSchema.Type;
	}
}

/** Commits one directional merge and returns exact before/after actor identities. */
export const commitMergeItemsFx = Effect.fn("commitMergeItemsFx")(function* ({
	sourceItemId,
	sourceRevision,
	targetItemId,
	targetRevision,
}: commitMergeItemsFx.Props) {
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
			const source = Option.getOrUndefined(yield* isGridRuntimeItemFx(runtimeSource));
			if (source === undefined) {
				return yield* Effect.fail(
					new ItemNotOnGridError({
						itemId: runtimeSource.id,
						location: runtimeSource.location,
					}),
				);
			}
			const target = Option.getOrUndefined(yield* isBoardRuntimeItemFx(runtimeTarget));
			if (target === undefined) {
				return yield* Effect.fail(
					new ItemNotOnBoardError({
						itemId: runtimeTarget.id,
						location: runtimeTarget.location,
					}),
				);
			}
			const boardSource = Option.getOrUndefined(yield* isBoardRuntimeItemFx(source));
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
			} satisfies commitMergeItemsFx.Result;

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
