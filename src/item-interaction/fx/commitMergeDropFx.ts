import { Effect } from "effect";

import type { IdSchema } from "~/game-config/schema/IdSchema";
import type { RevisionSchema } from "~/item-revision/schema/RevisionSchema";
import { mergeItemsFx } from "~/item-merge/fx/mergeItemsFx";
import { makeDropActorRejectedResultFn } from "~/item-interaction/fn/makeDropActorRejectedResultFn";
import { makeDropRejectedResultFn } from "~/item-interaction/fn/makeDropRejectedResultFn";
import { projectDropActorCurrentFn } from "~/item-interaction/fn/projectDropActorCurrentFn";
import { projectDropTransferActorFn } from "~/item-interaction/fn/projectDropTransferActorFn";
import { DropItemRejectedReason } from "~/item-interaction/type/DropItemResult";
import type { DropItemResult } from "~/item-interaction/type/DropItemResult";
import { DropItemResultKind } from "~/item-interaction/type/DropItemResult";

export namespace commitMergeDropFx {
	export interface Props {
		readonly sourceItemId: IdSchema.Type;
		readonly sourceRevision: RevisionSchema.Type;
		readonly targetItemId: IdSchema.Type;
		readonly targetRevision: RevisionSchema.Type;
	}
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
		Effect.map((result): DropItemResult => {
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
