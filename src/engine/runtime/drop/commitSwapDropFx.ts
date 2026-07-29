import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import type { RevisionSchema } from "~/engine/revision/schema/RevisionSchema";
import {
	makeDropRejectedResult,
	makeInvalidGridDropRejectedResult,
} from "~/engine/runtime/drop/makeDropRejectedResult";
import { makeDropCommitRaceHandlers } from "~/engine/runtime/drop/makeDropCommitRaceHandlers";
import { DropItemIgnoredReasonEnumSchema } from "~/engine/runtime/schema/command/DropItemIgnoredReasonEnumSchema";
import { DropItemRejectedReasonEnumSchema } from "~/engine/runtime/schema/command/DropItemRejectedReasonEnumSchema";
import type { DropItemResultSchema } from "~/engine/runtime/schema/command/DropItemResultSchema";
import { DropItemResultKindEnumSchema } from "~/engine/runtime/schema/command/DropItemResultKindEnumSchema";
import { swapItemsFx } from "~/engine/runtime/write/swapItemsFx";

export namespace commitSwapDropFx {
	export interface Props {
		readonly expectedCollisions: ReadonlyArray<{
			readonly itemId: IdSchema.Type;
			readonly revision: RevisionSchema.Type;
		}>;
		readonly destinationLocation?: GridLocationSchema.Type;
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
	expectedCollisions,
	destinationLocation,
	sourceItemId,
	sourceRevision,
	sourceLocation,
	targetItemId,
	targetRevision,
	targetLocation,
}: commitSwapDropFx.Props) {
	return yield* swapItemsFx({
		destinationLocation,
		expectedCollisions,
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
				relocations: result.relocations.map(({ item, previousLocation }) => {
					return {
						itemId: item.id,
						revision: item.revision,
						previousLocation,
						location: item.location,
					};
				}),
			}),
		),
		Effect.catchTags({
			...makeDropCommitRaceHandlers({
				sourceItemId,
				targetItemId,
			}),
			ItemNotOnGridError: (error) =>
				Effect.succeed(
					makeInvalidGridDropRejectedResult({
						itemId: error.itemId,
						sourceItemId,
						targetItemId,
					}),
				),
			CrossSpaceBoardOperationError: () =>
				Effect.succeed(
					makeDropRejectedResult({
						reason: DropItemRejectedReasonEnumSchema.enum.InvalidTarget,
						sourceItemId,
						targetItemId,
					}),
				),
			LocationOccupiedError: () =>
				Effect.succeed(
					makeDropRejectedResult({
						reason: DropItemRejectedReasonEnumSchema.enum.Blocked,
						sourceItemId,
						targetItemId,
					}),
				),
			PlacementUnavailableError: () =>
				Effect.succeed(
					makeDropRejectedResult({
						reason: DropItemRejectedReasonEnumSchema.enum.Blocked,
						sourceItemId,
						targetItemId,
					}),
				),
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
