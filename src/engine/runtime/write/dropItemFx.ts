import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import { isSameGridLocation } from "~/engine/location/read/isSameGridLocation";
import type { RevisionSchema } from "~/engine/revision/schema/RevisionSchema";
import type { DropItemResultSchema } from "~/engine/runtime/schema/command/DropItemResultSchema";
import { moveItemFx } from "~/engine/runtime/write/moveItemFx";

export namespace dropItemFx {
	export interface Props {
		readonly sourceItemId: IdSchema.Type;
		readonly sourceRevision: RevisionSchema.Type;
		readonly sourceLocation: GridLocationSchema.Type;
		readonly target:
			| {
					readonly kind: "slot";
					readonly location: GridLocationSchema.Type;
			  }
			| {
					readonly kind: "unsupported";
			  };
	}

	export type Result = DropItemResultSchema.Type;
}

/** Resolves one requested item drop through the current atomic runtime command path. */
export const dropItemFx = Effect.fn("dropItemFx")(function* ({
	sourceItemId,
	sourceRevision,
	sourceLocation,
	target,
}: dropItemFx.Props) {
	if (target.kind === "unsupported") {
		return {
			kind: "reject",
			reason: "unsupported-target",
			itemId: sourceItemId,
		} satisfies dropItemFx.Result;
	}

	return yield* moveItemFx({
		itemId: sourceItemId,
		revision: sourceRevision,
		expectedLocation: sourceLocation,
		location: target.location,
	}).pipe(
		Effect.map((result): dropItemFx.Result => {
			if (isSameGridLocation(result.previousLocation, result.item.location)) {
				return {
					kind: "ignored",
					reason: "same-location",
					itemId: sourceItemId,
					location: result.item.location,
				};
			}
			return {
				kind: "move",
				itemId: result.item.id,
				revision: result.item.revision,
				previousLocation: result.previousLocation,
				location: result.item.location,
			};
		}),
		Effect.catchTags({
			LocationOccupiedError: (error) =>
				Effect.succeed({
					kind: "reject" as const,
					reason: "occupied" as const,
					itemId: sourceItemId,
					targetItemId: error.itemId,
				}),
			ItemNotFoundError: () =>
				Effect.succeed({
					kind: "reject" as const,
					reason: "stale-source" as const,
					itemId: sourceItemId,
				}),
			RevisionConflictError: () =>
				Effect.succeed({
					kind: "reject" as const,
					reason: "stale-source" as const,
					itemId: sourceItemId,
				}),
			ItemLocationConflictError: () =>
				Effect.succeed({
					kind: "reject" as const,
					reason: "stale-source" as const,
					itemId: sourceItemId,
				}),
			ItemNotOnGridError: () =>
				Effect.succeed({
					kind: "reject" as const,
					reason: "invalid-source" as const,
					itemId: sourceItemId,
				}),
			CrossSpaceBoardOperationError: () =>
				Effect.succeed({
					kind: "reject" as const,
					reason: "invalid-target" as const,
					itemId: sourceItemId,
				}),
		}),
	);
});
