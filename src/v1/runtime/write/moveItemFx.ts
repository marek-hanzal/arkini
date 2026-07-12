import { Array, Effect, Option, pipe } from "effect";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import { ItemNotFoundError } from "~/v1/item/error/ItemNotFoundError";
import { ItemNotOnGridError } from "~/v1/item/error/ItemNotOnGridError";
import type { GridLocationSchema } from "~/v1/location/schema/GridLocationSchema";
import { assertRevisionFx } from "~/v1/revision/fx/assertRevisionFx";
import type { RevisionSchema } from "~/v1/revision/schema/RevisionSchema";
import { LocationOccupiedError } from "~/v1/runtime/error/LocationOccupiedError";
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

			const occupant = pipe(
				runtime.items,
				Array.findFirst((candidate) => {
					return (
						candidate.id !== itemId &&
						candidate.location.scope === location.scope &&
						candidate.location.position.x === location.position.x &&
						candidate.location.position.y === location.position.y
					);
				}),
				Option.getOrUndefined,
			);
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
