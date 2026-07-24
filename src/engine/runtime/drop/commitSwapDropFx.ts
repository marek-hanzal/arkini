import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import type { RevisionSchema } from "~/engine/revision/schema/RevisionSchema";
import { DropItemIgnoredReasonEnumSchema } from "~/engine/runtime/schema/command/DropItemIgnoredReasonEnumSchema";
import { DropItemRejectedReasonEnumSchema } from "~/engine/runtime/schema/command/DropItemRejectedReasonEnumSchema";
import type { DropItemResultSchema } from "~/engine/runtime/schema/command/DropItemResultSchema";
import { DropItemResultKindEnumSchema } from "~/engine/runtime/schema/command/DropItemResultKindEnumSchema";
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

	export type Result = DropItemResultSchema.Type;
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
				kind: DropItemResultKindEnumSchema.enum.Swap,
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
				Effect.succeed({
					kind: DropItemResultKindEnumSchema.enum.Reject,
					reason:
						error.itemId === targetItemId
							? DropItemRejectedReasonEnumSchema.enum.StaleTarget
							: DropItemRejectedReasonEnumSchema.enum.StaleSource,
					itemId: sourceItemId,
					targetItemId,
				}),
			RevisionConflictError: (error) =>
				Effect.succeed({
					kind: DropItemResultKindEnumSchema.enum.Reject,
					reason:
						error.entityId === targetItemId
							? DropItemRejectedReasonEnumSchema.enum.StaleTarget
							: DropItemRejectedReasonEnumSchema.enum.StaleSource,
					itemId: sourceItemId,
					targetItemId,
				}),
			ItemNotOnGridError: (error) =>
				Effect.succeed({
					kind: DropItemResultKindEnumSchema.enum.Reject,
					reason:
						error.itemId === targetItemId
							? DropItemRejectedReasonEnumSchema.enum.InvalidTarget
							: DropItemRejectedReasonEnumSchema.enum.InvalidSource,
					itemId: sourceItemId,
					targetItemId,
				}),
			CrossSpaceBoardOperationError: () =>
				Effect.succeed({
					kind: DropItemResultKindEnumSchema.enum.Reject,
					reason: DropItemRejectedReasonEnumSchema.enum.InvalidTarget,
					itemId: sourceItemId,
					targetItemId,
				}),
			SwapSameItemError: () =>
				Effect.succeed({
					kind: DropItemResultKindEnumSchema.enum.Ignored,
					reason: DropItemIgnoredReasonEnumSchema.enum.SameLocation,
					itemId: sourceItemId,
					location: sourceLocation,
				}),
		}),
	);
});
