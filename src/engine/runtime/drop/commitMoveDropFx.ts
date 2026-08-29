import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import type { RevisionSchema } from "~/engine/revision/schema/RevisionSchema";
import { DropItemRejectedReason } from "~/engine/runtime/DropItemResult";
import type { DropItemResult } from "~/engine/runtime/DropItemResult";
import { DropItemResultKind } from "~/engine/runtime/DropItemResult";
import { moveItemFx } from "~/engine/runtime/write/moveItemFx";

export namespace commitMoveDropFx {
	export interface Props {
		readonly sourceItemId: IdSchema.Type;
		readonly sourceRevision: RevisionSchema.Type;
		readonly sourceLocation: GridLocationSchema.Type;
		readonly targetLocation: GridLocationSchema.Type;
	}

	export type Result = DropItemResult;
}

/** Commits one exact empty-slot drop and normalizes its public result. */
export const commitMoveDropFx = Effect.fn("commitMoveDropFx")(function* ({
	sourceItemId,
	sourceRevision,
	sourceLocation,
	targetLocation,
}: commitMoveDropFx.Props) {
	return yield* moveItemFx({
		itemId: sourceItemId,
		revision: sourceRevision,
		expectedLocation: sourceLocation,
		location: targetLocation,
	}).pipe(
		Effect.map(
			(result): commitMoveDropFx.Result => ({
				kind: DropItemResultKind.Move,
				itemId: result.item.id,
				revision: result.item.revision,
				previousLocation: result.previousLocation,
				location: result.item.location,
			}),
		),
		Effect.catchTags({
			LocationOccupiedError: (error) =>
				Effect.succeed({
					kind: DropItemResultKind.Reject,
					reason: DropItemRejectedReason.Occupied,
					itemId: sourceItemId,
					targetItemId: error.itemId,
				}),
			ItemNotFoundError: () =>
				Effect.succeed({
					kind: DropItemResultKind.Reject,
					reason: DropItemRejectedReason.StaleSource,
					itemId: sourceItemId,
				}),
			RevisionConflictError: () =>
				Effect.succeed({
					kind: DropItemResultKind.Reject,
					reason: DropItemRejectedReason.StaleSource,
					itemId: sourceItemId,
				}),
			ItemLocationConflictError: () =>
				Effect.succeed({
					kind: DropItemResultKind.Reject,
					reason: DropItemRejectedReason.StaleSource,
					itemId: sourceItemId,
				}),
			ItemNotOnGridError: () =>
				Effect.succeed({
					kind: DropItemResultKind.Reject,
					reason: DropItemRejectedReason.InvalidSource,
					itemId: sourceItemId,
				}),
			CrossSpaceBoardOperationError: () =>
				Effect.succeed({
					kind: DropItemResultKind.Reject,
					reason: DropItemRejectedReason.InvalidTarget,
					itemId: sourceItemId,
				}),
		}),
	);
});
