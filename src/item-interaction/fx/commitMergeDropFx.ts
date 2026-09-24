import { Effect } from "effect";

import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { RevisionSchema } from "~/item-revision/schema/RevisionSchema";
import type { BoardLocationSchema } from "~/item-location/schema/BoardLocationSchema";
import { mergeItemsFx } from "~/item-merge/fx/mergeItemsFx";
import { makeDropActorRejectedResultFn } from "~/item-interaction/fn/makeDropActorRejectedResultFn";
import { makeDropRejectedResultFn } from "~/item-interaction/fn/makeDropRejectedResultFn";
import { DropItemRejectedReason } from "~/item-interaction/type/DropItemResult";
import type { DropItemResult } from "~/item-interaction/type/DropItemResult";
import { DropItemResultKind } from "~/item-interaction/type/DropItemResult";

interface DropTransferActor {
	readonly id: string;
	readonly item: {
		readonly uid: string;
	};
	readonly revision: string;
	readonly location: BoardLocationSchema.Type;
}

const projectDropActorCurrentFn = (item: DropTransferActor | undefined) =>
	item === undefined
		? null
		: {
				itemId: item.id,
				itemUid: item.item.uid,
				revision: item.revision,
				location: item.location,
			};

const projectDropTransferActorFn = ({
	after,
	before,
}: {
	readonly after: DropTransferActor | undefined;
	readonly before: DropTransferActor;
}) => ({
	itemId: before.id,
	itemUid: before.item.uid,
	previousRevision: before.revision,
	previousLocation: before.location,
	current: projectDropActorCurrentFn(after),
});

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
				resultItemUid: result.event.resultItemUid,
				source: {
					itemId: result.sourceBefore.id,
					previousRevision: result.sourceBefore.revision,
					previousLocation: result.sourceBefore.location,
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
			PreviousSpaceUnavailableError: rejectBlockedFx,
			ItemUnitsUnavailableError: rejectBlockedFx,
			ItemStatefulError: rejectBlockedFx,
			PlacementUnavailableError: rejectBlockedFx,
			JobOwnerBusyError: rejectBlockedFx,
			ItemJobScopedError: rejectBlockedFx,
			MergeSameItemError: rejectBlockedFx,
		}),
	);
});
