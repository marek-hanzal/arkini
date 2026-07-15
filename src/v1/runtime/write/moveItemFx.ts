import { Array, Effect, Option, pipe } from "effect";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import { ItemNotFoundError } from "~/v1/item/error/ItemNotFoundError";
import { ItemNotOnGridError } from "~/v1/item/error/ItemNotOnGridError";
import { readGridLocationOccupantsFx } from "~/v1/location/read/readGridLocationOccupantsFx";
import type { GridLocationSchema } from "~/v1/location/schema/GridLocationSchema";
import { assertRevisionFx } from "~/v1/revision/fx/assertRevisionFx";
import type { RevisionSchema } from "~/v1/revision/schema/RevisionSchema";
import { LocationOccupiedError } from "~/v1/runtime/error/LocationOccupiedError";
import { CrossSpaceBoardOperationError } from "~/v1/space/error/CrossSpaceBoardOperationError";
import { reviseRuntimeItemFx } from "~/v1/runtime/fx/reviseRuntimeItemFx";
import { modifyRuntimeFx } from "~/v1/runtime/internal/modifyRuntimeFx";
import { isGridRuntimeItem } from "~/v1/runtime/read/isGridRuntimeItem";
import type { MoveItemResultSchema } from "~/v1/runtime/schema/command/MoveItemResultSchema";
import type { RuntimeItemSchema } from "~/v1/runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";

export namespace moveItemFx {
	export interface Props {
		itemId: IdSchema.Type;
		location: GridLocationSchema.Type;
		revision: RevisionSchema.Type;
	}
}

/**
 * Atomically moves one live item to an unoccupied location.
 */
export const moveItemFx = Effect.fn("moveItemFx")(function* ({
	itemId,
	location,
	revision,
}: moveItemFx.Props) {
	return yield* modifyRuntimeFx((runtime) => {
		return Effect.gen(function* () {
			const item = pipe(
				runtime.items,
				Array.findFirst((candidate) => candidate.id === itemId),
				Option.getOrUndefined,
			);
			if (item === undefined) {
				return yield* Effect.fail(
					new ItemNotFoundError({
						itemId,
					}),
				);
			}
			yield* assertRevisionFx({
				actualRevision: item.revision,
				entityId: item.id,
				expectedRevision: revision,
			});
			if (!isGridRuntimeItem(item)) {
				return yield* Effect.fail(
					new ItemNotOnGridError({
						itemId,
						location: item.location,
					}),
				);
			}

			if (
				item.location.scope === "board" &&
				location.scope === "board" &&
				item.location.space !== location.space
			) {
				return yield* Effect.fail(
					new CrossSpaceBoardOperationError({
						fromSpace: item.location.space,
						toSpace: location.space,
					}),
				);
			}
			if (
				item.location.scope === "inventory" &&
				location.scope === "board" &&
				location.space !== runtime.currentSpace
			) {
				return yield* Effect.fail(
					new CrossSpaceBoardOperationError({
						fromSpace: runtime.currentSpace,
						toSpace: location.space,
					}),
				);
			}

			const [occupants] = yield* readGridLocationOccupantsFx({
				items: runtime.items
					.filter(isGridRuntimeItem)
					.filter((candidate) => candidate.id !== itemId),
				locations: [
					location,
				],
			});
			const occupant = occupants?.items[0];
			if (occupant !== undefined) {
				return yield* Effect.fail(
					new LocationOccupiedError({
						itemId: occupant.id,
						location,
					}),
				);
			}

			const movedItem = yield* reviseRuntimeItemFx({
				item: {
					...item,
					location,
				} satisfies RuntimeItemSchema.Type,
			});
			const result = {
				item: movedItem,
				previousLocation: item.location,
			} satisfies MoveItemResultSchema.Type;

			const nextRuntime = {
				...runtime,
				items: runtime.items.map((candidate) => {
					return candidate.id === itemId ? movedItem : candidate;
				}),
			} satisfies RuntimeSchema.Type;

			return [
				result,
				nextRuntime,
			] as const;
		});
	});
});
