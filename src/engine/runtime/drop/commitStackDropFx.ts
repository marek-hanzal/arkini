import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import type { RevisionSchema } from "~/engine/revision/schema/RevisionSchema";
import { makeDropRejectedResultFn } from "~/engine/runtime/drop/fn/makeDropRejectedResultFn";
import { projectDropTransferActorFx } from "~/engine/runtime/drop/projectDropTransferActorFx";
import { readDropItemStackRejectedReasonFn } from "~/engine/runtime/read/fn/readDropItemStackRejectedReasonFn";
import { DropItemRejectedReason } from "~/engine/runtime/DropItemResult";
import type { DropItemResult } from "~/engine/runtime/DropItemResult";
import { DropItemResultKind } from "~/engine/runtime/DropItemResult";
import { stackItemsFx } from "~/engine/runtime/write/stackItemsFx";

export namespace commitStackDropFx {
	export interface Props {
		readonly sourceItemId: IdSchema.Type;
		readonly sourceRevision: RevisionSchema.Type;
		readonly sourceLocation: GridLocationSchema.Type;
		readonly targetItemId: IdSchema.Type;
		readonly targetRevision: RevisionSchema.Type;
		readonly targetLocation: GridLocationSchema.Type;
	}

	export type Result = DropItemResult;
}

/** Commits one exact pure-stack transfer and normalizes both actor identities. */
export const commitStackDropFx = Effect.fn("commitStackDropFx")(function* ({
	sourceItemId,
	sourceRevision,
	sourceLocation,
	targetItemId,
	targetRevision,
	targetLocation,
}: commitStackDropFx.Props) {
	return yield* stackItemsFx({
		sourceItemId,
		sourceRevision,
		sourceLocation,
		targetItemId,
		targetRevision,
		targetLocation,
	}).pipe(
		Effect.flatMap((result) =>
			projectDropTransferActorFx({
				after: result.sourceAfter,
				before: result.sourceBefore,
			}).pipe(
				Effect.map(
					(source): commitStackDropFx.Result => ({
						kind: DropItemResultKind.Stack,
						transferredQuantity: result.transferredQuantity,
						source,
						target: {
							itemId: result.targetBefore.id,
							canonicalItemId: result.targetBefore.item.id,
							previousRevision: result.targetBefore.revision,
							previousLocation: result.targetBefore.location,
							previousQuantity: result.targetBefore.quantity,
							current: {
								itemId: result.targetAfter.id,
								canonicalItemId: result.targetAfter.item.id,
								revision: result.targetAfter.revision,
								location: result.targetAfter.location,
								quantity: result.targetAfter.quantity,
							},
						},
					}),
				),
			),
		),
		Effect.catchTag("StackItemsUnavailableError", (error) =>
			Effect.succeed(
				makeDropRejectedResultFn({
					reason: readDropItemStackRejectedReasonFn({
						reason: error.reason,
					}),
					sourceItemId,
					targetItemId,
				}),
			),
		),
		Effect.catchTags({
			ItemNotFoundError: (error) =>
				Effect.succeed(
					makeDropRejectedResultFn({
						reason:
							error.itemId === targetItemId
								? DropItemRejectedReason.StaleTarget
								: DropItemRejectedReason.StaleSource,
						sourceItemId,
						targetItemId,
					}),
				),
			JobOwnerBusyError: () =>
				Effect.succeed(
					makeDropRejectedResultFn({
						reason: DropItemRejectedReason.Blocked,
						sourceItemId,
						targetItemId,
					}),
				),
		}),
	);
});
