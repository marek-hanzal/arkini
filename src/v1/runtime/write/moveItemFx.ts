import { Array, Effect, Option, pipe, SynchronizedRef } from "effect";

import { assertRuntimeFx } from "~/v1/runtime/check/assertRuntimeFx";
import type { IdSchema } from "~/v1/common/schema/IdSchema";
import { ItemNotFoundError } from "~/v1/item/error/ItemNotFoundError";
import type { LocationSchema } from "~/v1/location/schema/LocationSchema";
import { LocationOccupiedError } from "~/v1/runtime/error/LocationOccupiedError";
import { RuntimeStoreFx } from "~/v1/runtime/internal/RuntimeStoreFx";
import type { MoveItemResultSchema } from "~/v1/runtime/schema/command/MoveItemResultSchema";
import type { RuntimeItemSchema } from "~/v1/runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";

export namespace moveItemFx {
	export interface Props {
		itemId: IdSchema.Type;
		location: LocationSchema.Type;
	}
}

/**
 * Atomically moves one live item to an unoccupied location.
 */
export const moveItemFx = Effect.fn("moveItemFx")(function* ({
	itemId,
	location,
}: moveItemFx.Props) {
	const store = yield* RuntimeStoreFx;

	return yield* SynchronizedRef.modifyEffect(store, (runtime) => {
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

			const movedItem = {
				...item,
				location,
			} satisfies RuntimeItemSchema.Type;
			const result = {
				item: movedItem,
				previousLocation: item.location,
			} satisfies MoveItemResultSchema.Type;

			const nextRuntime = {
				items: runtime.items.map((candidate) => {
					return candidate.id === itemId ? movedItem : candidate;
				}),
			} satisfies RuntimeSchema.Type;
			yield* assertRuntimeFx({
				runtime: nextRuntime,
			});

			return [
				result,
				nextRuntime,
			] as const;
		});
	});
});
