import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import type { RevisionSchema } from "~/engine/revision/schema/RevisionSchema";
import { makeDropRejectedResultFx } from "~/engine/runtime/drop/makeDropRejectedResultFx";
import { projectDropTransferActor } from "~/engine/runtime/drop/projectDropTransferActor";
import { readDropItemStackRejectedReasonFx } from "~/engine/runtime/read/readDropItemStackRejectedReasonFx";
import { DropItemRejectedReasonEnumSchema } from "~/engine/runtime/schema/command/DropItemRejectedReasonEnumSchema";
import type { DropItemResultSchema } from "~/engine/runtime/schema/command/DropItemResultSchema";
import { DropItemResultKindEnumSchema } from "~/engine/runtime/schema/command/DropItemResultKindEnumSchema";
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

	export type Result = DropItemResultSchema.Type;
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
		Effect.map(
			(result): commitStackDropFx.Result => ({
				kind: DropItemResultKindEnumSchema.enum.Stack,
				transferredQuantity: result.transferredQuantity,
				source: projectDropTransferActor({
					after: result.sourceAfter,
					before: result.sourceBefore,
				}),
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
		Effect.catchTag("StackItemsUnavailableError", (error) =>
			readDropItemStackRejectedReasonFx({
				reason: error.reason,
			}).pipe(
				Effect.flatMap((reason) =>
					makeDropRejectedResultFx({
						reason,
						sourceItemId,
						targetItemId,
					}),
				),
			),
		),
		Effect.catchTags({
			ItemNotFoundError: (error) =>
				makeDropRejectedResultFx({
					reason:
						error.itemId === targetItemId
							? DropItemRejectedReasonEnumSchema.enum.StaleTarget
							: DropItemRejectedReasonEnumSchema.enum.StaleSource,
					sourceItemId,
					targetItemId,
				}),
			JobOwnerBusyError: () =>
				makeDropRejectedResultFx({
					reason: DropItemRejectedReasonEnumSchema.enum.Blocked,
					sourceItemId,
					targetItemId,
				}),
		}),
	);
});
