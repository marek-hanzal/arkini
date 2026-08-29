import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import type { RevisionSchema } from "~/engine/revision/schema/RevisionSchema";
import { makeDropActorRejectedResultFx } from "~/engine/runtime/drop/makeDropActorRejectedResultFx";
import { makeDropRejectedResultFn } from "~/engine/runtime/drop/fn/makeDropRejectedResultFn";
import { DropItemIgnoredReason } from "~/engine/runtime/DropItemResult";
import { DropItemRejectedReason } from "~/engine/runtime/DropItemResult";
import type { DropItemResult } from "~/engine/runtime/DropItemResult";
import { DropItemResultKind } from "~/engine/runtime/DropItemResult";
import { swapItemsFx } from "~/engine/runtime/write/swapItemsFx";

export namespace commitSwapDropFx {
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

/** Commits one exact grid swap and normalizes both actor identities. */
export const commitSwapDropFx = Effect.fn("commitSwapDropFx")(function* ({
	sourceItemId,
	sourceRevision,
	sourceLocation,
	targetItemId,
	targetRevision,
	targetLocation,
}: commitSwapDropFx.Props) {
	return yield* swapItemsFx({
		firstItemId: sourceItemId,
		firstItemRevision: sourceRevision,
		secondItemId: targetItemId,
		secondItemRevision: targetRevision,
	}).pipe(
		Effect.map(
			(result): commitSwapDropFx.Result => ({
				kind: DropItemResultKind.Swap,
				source: {
					itemId: result.first.id,
					revision: result.first.revision,
					previousLocation: sourceLocation,
					location: result.first.location,
				},
				target: {
					itemId: result.second.id,
					revision: result.second.revision,
					previousLocation: targetLocation,
					location: result.second.location,
				},
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
			ItemNotOnGridError: (error) =>
				makeDropActorRejectedResultFx({
					failedItemId: error.itemId,
					failure: "invalid-location",
					sourceItemId,
					targetItemId,
				}),
			CrossSpaceBoardOperationError: () =>
				Effect.succeed(
					makeDropRejectedResultFn({
						reason: DropItemRejectedReason.InvalidTarget,
						sourceItemId,
						targetItemId,
					}),
				),
			SwapSameItemError: () =>
				Effect.succeed({
					kind: DropItemResultKind.Ignored,
					reason: DropItemIgnoredReason.SameLocation,
					itemId: sourceItemId,
					location: sourceLocation,
				}),
		}),
	);
});
