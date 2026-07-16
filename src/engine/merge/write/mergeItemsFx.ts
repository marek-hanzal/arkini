import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { ItemMergedGameEventSchema } from "~/engine/event/schema/ItemMergedGameEventSchema";
import { ItemNotOnBoardError } from "~/engine/item/error/ItemNotOnBoardError";
import { ItemNotOnGridError } from "~/engine/item/error/ItemNotOnGridError";
import { applyMergeRuntimeFx } from "~/engine/merge/fx/applyMergeRuntimeFx";
import { resolveMergeRuleFx } from "~/engine/merge/fx/resolveMergeRuleFx";
import { makeMergeRandomFx } from "~/engine/merge/random/makeMergeRandomFx";
import { MergeSameItemError } from "~/engine/merge/error/MergeSameItemError";
import { assertRevisionFx } from "~/engine/revision/fx/assertRevisionFx";
import type { RevisionSchema } from "~/engine/revision/schema/RevisionSchema";
import { modifyRuntimeFx } from "~/engine/runtime/internal/modifyRuntimeFx";
import { isBoardRuntimeItem } from "~/engine/runtime/read/isBoardRuntimeItem";
import { isGridRuntimeItem } from "~/engine/runtime/read/isGridRuntimeItem";
import { readRuntimeItemByIdFx } from "~/engine/runtime/read/readRuntimeItemByIdFx";
import { CrossSpaceBoardOperationError } from "~/engine/space/error/CrossSpaceBoardOperationError";

export namespace mergeItemsFx {
	export interface Props {
		sourceItemId: IdSchema.Type;
		sourceRevision: RevisionSchema.Type;
		targetItemId: IdSchema.Type;
		targetRevision: RevisionSchema.Type;
	}

	export type Result = ItemMergedGameEventSchema.Type;
}

/** Atomically executes one source-owned directional gameplay merge. */
export const mergeItemsFx = Effect.fn("mergeItemsFx")(function* ({
	sourceItemId,
	sourceRevision,
	targetItemId,
	targetRevision,
}: mergeItemsFx.Props) {
	if (sourceItemId === targetItemId) {
		return yield* Effect.fail(
			new MergeSameItemError({
				itemId: sourceItemId,
			}),
		);
	}

	return yield* modifyRuntimeFx((runtime) =>
		Effect.gen(function* () {
			const source = yield* readRuntimeItemByIdFx({
				itemId: sourceItemId,
				runtime,
			});
			const target = yield* readRuntimeItemByIdFx({
				itemId: targetItemId,
				runtime,
			});
			yield* assertRevisionFx({
				actualRevision: source.revision,
				entityId: source.id,
				expectedRevision: sourceRevision,
			});
			yield* assertRevisionFx({
				actualRevision: target.revision,
				entityId: target.id,
				expectedRevision: targetRevision,
			});
			if (!isGridRuntimeItem(source)) {
				return yield* Effect.fail(
					new ItemNotOnGridError({
						itemId: source.id,
						location: source.location,
					}),
				);
			}
			if (!isBoardRuntimeItem(target)) {
				return yield* Effect.fail(
					new ItemNotOnBoardError({
						itemId: target.id,
						location: target.location,
					}),
				);
			}
			if (isBoardRuntimeItem(source) && source.location.space !== target.location.space) {
				return yield* Effect.fail(
					new CrossSpaceBoardOperationError({
						fromSpace: source.location.space,
						toSpace: target.location.space,
					}),
				);
			}

			const resolved = yield* resolveMergeRuleFx({
				source,
				target,
			});
			const random = yield* makeMergeRandomFx({
				rule: resolved.rule,
				ruleIndex: resolved.index,
				source,
				target,
			});
			const nextRuntime = yield* applyMergeRuntimeFx({
				rule: resolved.rule,
				runtime,
				source,
				target,
			}).pipe(Effect.withRandom(random));
			const event = {
				type: "item:merged",
				sourceItemId: source.id,
				sourceCanonicalItemId: source.item.id,
				targetItemId: target.id,
				targetCanonicalItemId: target.item.id,
				action: resolved.rule.action,
				effect: resolved.rule.effect,
				resultCanonicalItemId:
					resolved.rule.effect === "replace" ? resolved.rule.result : undefined,
			} satisfies ItemMergedGameEventSchema.Type;

			return [
				event,
				nextRuntime,
				[
					event,
				],
			] as const;
		}),
	);
});
