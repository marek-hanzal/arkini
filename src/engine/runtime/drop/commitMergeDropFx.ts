import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { RevisionSchema } from "~/engine/revision/schema/RevisionSchema";
import { mergeItemsFx } from "~/engine/merge/write/mergeItemsFx";
import { makeDropActorRejectedResultFn } from "~/engine/runtime/drop/fn/makeDropActorRejectedResultFn";
import { makeDropRejectedResultFn } from "~/engine/runtime/drop/fn/makeDropRejectedResultFn";
import { projectDropActorCurrentFn } from "~/engine/runtime/drop/fn/projectDropActorCurrentFn";
import { projectDropTransferActorFn } from "~/engine/runtime/drop/fn/projectDropTransferActorFn";
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
		Effect.succeed(
			makeDropRejectedResultFn({
				reason: DropItemRejectedReason.Blocked,
				sourceItemId,
				targetItemId,
			}),
		);
	return yield* mergeItemsFx({
		sourceItemId,
		sourceRevision,
		targetItemId,
		targetRevision,
	}).pipe(
		Effect.map((result): commitMergeDropFx.Result => {
			const sourceCurrent = projectDropActorCurrentFn(result.sourceAfter);
			const target = projectDropTransferActorFn({
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
			};
		}),
		Effect.catchTags({
			ItemNotFoundError: (error) =>
				Effect.succeed(
					makeDropActorRejectedResultFn({
						failedItemId: error.itemId,
						failure: "stale",
						sourceItemId,
						targetItemId,
					}),
				),
			RevisionConflictError: (error) =>
				Effect.succeed(
					makeDropActorRejectedResultFn({
						failedItemId: error.entityId,
						failure: "stale",
						sourceItemId,
						targetItemId,
					}),
				),
			ItemNotOnGridError: () =>
				Effect.succeed(
					makeDropRejectedResultFn({
						reason: DropItemRejectedReason.InvalidSource,
						sourceItemId,
						targetItemId,
					}),
				),
			ItemNotOnBoardError: () =>
				Effect.succeed(
					makeDropRejectedResultFn({
						reason: DropItemRejectedReason.InvalidTarget,
						sourceItemId,
						targetItemId,
					}),
				),
			CrossSpaceBoardOperationError: () =>
				Effect.succeed(
					makeDropRejectedResultFn({
						reason: DropItemRejectedReason.InvalidTarget,
						sourceItemId,
						targetItemId,
					}),
				),
			MergeRuleNotFoundError: () =>
				Effect.succeed(
					makeDropRejectedResultFn({
						reason: DropItemRejectedReason.InvalidTarget,
						sourceItemId,
						targetItemId,
					}),
				),
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
