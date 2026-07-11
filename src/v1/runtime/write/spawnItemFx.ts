import { Array, Effect, Option, pipe, SynchronizedRef } from "effect";

import { assertRuntimeFx } from "~/v1/runtime/check/assertRuntimeFx";
import type { IdSchema } from "~/v1/common/schema/IdSchema";
import type { PositiveIntegerSchema } from "~/v1/common/schema/PositiveIntegerSchema";
import { resolveItemFx } from "~/v1/item/fx/resolveItemFx";
import type { GridLocationSchema } from "~/v1/location/schema/GridLocationSchema";
import { ItemAlreadyExistsError } from "~/v1/runtime/error/ItemAlreadyExistsError";
import { LocationOccupiedError } from "~/v1/runtime/error/LocationOccupiedError";
import { RuntimeStoreFx } from "~/v1/runtime/internal/RuntimeStoreFx";
import type { RuntimeItemSchema } from "~/v1/runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";

export namespace spawnItemFx {
	export interface Props {
		id: IdSchema.Type;
		itemId: IdSchema.Type;
		location: GridLocationSchema.Type;
		quantity: PositiveIntegerSchema.Type;
	}
}

/**
 * Atomically creates one new live item at an unoccupied location.
 */
export const spawnItemFx = Effect.fn("spawnItemFx")(function* ({
	id,
	itemId,
	location,
	quantity,
}: spawnItemFx.Props) {
	const item = yield* resolveItemFx({
		itemId,
	});
	const runtimeItem = {
		id,
		item,
		location,
		quantity,
	} satisfies RuntimeItemSchema.Type;
	const store = yield* RuntimeStoreFx;

	return yield* SynchronizedRef.modifyEffect(store, (runtime) => {
		return Effect.gen(function* () {
			const duplicate = pipe(
				runtime.items,
				Array.findFirst((candidate) => candidate.id === id),
				Option.getOrUndefined,
			);
			if (duplicate !== undefined) {
				return yield* Effect.fail(
					new ItemAlreadyExistsError({
						itemId: id,
					}),
				);
			}

			const occupant = pipe(
				runtime.items,
				Array.findFirst((candidate) => {
					return (
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

			const nextRuntime = {
				items: [
					...runtime.items,
					runtimeItem,
				],
			} satisfies RuntimeSchema.Type;
			yield* assertRuntimeFx({
				runtime: nextRuntime,
			});

			return [
				runtimeItem,
				nextRuntime,
			] as const;
		});
	});
});
