import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { RevisionSchema } from "~/engine/revision/schema/RevisionSchema";
import { commitMergeItemsFx } from "~/engine/merge/internal/commitMergeItemsFx";
import { makeDropActorRejectedResultFx } from "~/engine/runtime/drop/makeDropActorRejectedResultFx";
import { makeDropRejectedResultFx } from "~/engine/runtime/drop/makeDropRejectedResultFx";
import { projectDropActorCurrentFx } from "~/engine/runtime/drop/projectDropActorCurrentFx";
import { projectDropTransferActorFx } from "~/engine/runtime/drop/projectDropTransferActorFx";
import { DropItemRejectedReason } from "~/engine/runtime/DropItemResult";
import type { DropItemResult } from "~/engine/runtime/DropItemResult";
import { DropItemResultKind } from "~/engine/runtime/DropItemResult";

export namespace commitMergeDropFx {
	export interface Props {
		readonly sourceItemId: IdSchema.Type;
		readonly sourceRevision: RevisionSchema.Type;
		readonly targetItemId: IdSchema.Type;
		readonly targetRevision: RevisionSchema.Type;
	}

	export type Result = DropItemResult;
}

/** Commits one exact authored merge and normalizes both actor identities. */
export const commitMergeDropFx = Effect.fn("commitMergeDropFx")(function* ({
	sourceItemId,
	sourceRevision,
	targetItemId,
	targetRevision,
}: commitMergeDropFx.Props) {
	const rejectBlockedFx = () =>
		makeDropRejectedResultFx({
			reason: DropItemRejectedReason.Blocked,
			sourceItemId,
			targetItemId,
		});
	return yield* commitMergeItemsFx({
		sourceItemId,
		sourceRevision,
		targetItemId,
		targetRevision,
	}).pipe(
		Effect.flatMap((result) =>
			Effect.gen(function* () {
				const sourceCurrent = yield* projectDropActorCurrentFx(result.sourceAfter);
				const target = yield* projectDropTransferActorFx({
					after: result.targetAfter,
					before: result.targetBefore,
				});

				return {
					kind: DropItemResultKind.Merge,
					action: result.event.action,
					effect: result.event.effect,
					resultCanonicalItemId: result.event.resultCanonicalItemId,
					source: {
						itemId: result.sourceBefore.id,
						previousRevision: result.sourceBefore.revision,
						previousLocation: result.sourceBefore.location,
						previousQuantity: result.sourceBefore.quantity,
						current: sourceCurrent,
					},
					target,
				} satisfies commitMergeDropFx.Result;
			}),
		),
		Effect.catchTags({
			ItemNotFoundError: (error) =>
				makeDropActorRejectedResultFx({
					failedItemId: error.itemId,
					failure: "stale",
					sourceItemId,
					targetItemId,
				}),
			RevisionConflictError: (error) =>
				makeDropActorRejectedResultFx({
					failedItemId: error.entityId,
					failure: "stale",
					sourceItemId,
					targetItemId,
				}),
			ItemNotOnGridError: () =>
				makeDropRejectedResultFx({
					reason: DropItemRejectedReason.InvalidSource,
					sourceItemId,
					targetItemId,
				}),
			ItemNotOnBoardError: () =>
				makeDropRejectedResultFx({
					reason: DropItemRejectedReason.InvalidTarget,
					sourceItemId,
					targetItemId,
				}),
			CrossSpaceBoardOperationError: () =>
				makeDropRejectedResultFx({
					reason: DropItemRejectedReason.InvalidTarget,
					sourceItemId,
					targetItemId,
				}),
			MergeRuleNotFoundError: () =>
				makeDropRejectedResultFx({
					reason: DropItemRejectedReason.InvalidTarget,
					sourceItemId,
					targetItemId,
				}),
		}),
		Effect.catchTags({
			ItemStatefulError: rejectBlockedFx,
			PlacementUnavailableError: rejectBlockedFx,
			JobOwnerBusyError: rejectBlockedFx,
			ItemJobScopedError: rejectBlockedFx,
			MergeSameItemError: rejectBlockedFx,
		}),
	);
});
