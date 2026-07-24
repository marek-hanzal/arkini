import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import type { RevisionSchema } from "~/engine/revision/schema/RevisionSchema";
import { DropItemRejectedReasonEnumSchema } from "~/engine/runtime/schema/command/DropItemRejectedReasonEnumSchema";
import type { DropItemResultSchema } from "~/engine/runtime/schema/command/DropItemResultSchema";
import { DropItemResultKindEnumSchema } from "~/engine/runtime/schema/command/DropItemResultKindEnumSchema";
import { moveItemFx } from "~/engine/runtime/write/moveItemFx";

export namespace commitMoveDropFx {
	export interface Props {
		readonly sourceItemId: IdSchema.Type;
		readonly sourceRevision: RevisionSchema.Type;
		readonly sourceLocation: GridLocationSchema.Type;
		readonly targetLocation: GridLocationSchema.Type;
	}

	export type Result = DropItemResultSchema.Type;
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
				kind: DropItemResultKindEnumSchema.enum.Move,
				itemId: result.item.id,
				revision: result.item.revision,
				previousLocation: result.previousLocation,
				location: result.item.location,
			}),
		),
		Effect.catchTags({
			LocationOccupiedError: (error) =>
				Effect.succeed({
					kind: DropItemResultKindEnumSchema.enum.Reject,
					reason: DropItemRejectedReasonEnumSchema.enum.Occupied,
					itemId: sourceItemId,
					targetItemId: error.itemId,
				}),
			ItemNotFoundError: () =>
				Effect.succeed({
					kind: DropItemResultKindEnumSchema.enum.Reject,
					reason: DropItemRejectedReasonEnumSchema.enum.StaleSource,
					itemId: sourceItemId,
				}),
			RevisionConflictError: () =>
				Effect.succeed({
					kind: DropItemResultKindEnumSchema.enum.Reject,
					reason: DropItemRejectedReasonEnumSchema.enum.StaleSource,
					itemId: sourceItemId,
				}),
			ItemLocationConflictError: () =>
				Effect.succeed({
					kind: DropItemResultKindEnumSchema.enum.Reject,
					reason: DropItemRejectedReasonEnumSchema.enum.StaleSource,
					itemId: sourceItemId,
				}),
			ItemNotOnGridError: () =>
				Effect.succeed({
					kind: DropItemResultKindEnumSchema.enum.Reject,
					reason: DropItemRejectedReasonEnumSchema.enum.InvalidSource,
					itemId: sourceItemId,
				}),
			CrossSpaceBoardOperationError: () =>
				Effect.succeed({
					kind: DropItemResultKindEnumSchema.enum.Reject,
					reason: DropItemRejectedReasonEnumSchema.enum.InvalidTarget,
					itemId: sourceItemId,
				}),
		}),
	);
});
