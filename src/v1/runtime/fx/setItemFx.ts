import { Effect, Ref } from "effect";
import { match } from "ts-pattern";

import type { LocationSchema } from "~/v1/location/schema/LocationSchema";
import { RuntimeFx } from "~/v1/runtime/context/RuntimeFx";
import type { RuntimeItemSchema } from "~/v1/runtime/schema/RuntimeItemSchema";

export namespace setItemFx {
	export interface Props {
		item: RuntimeItemSchema.Type;
		location: LocationSchema.Type;
	}
}

/**
 * Writes one item to a concrete runtime cell through an atomic update.
 *
 * This transitional write path is replaced by dedicated spatial commands once
 * runtime storage no longer mirrors locations through grid records.
 */
export const setItemFx = Effect.fn("setItemFx")(function* ({ item, location }: setItemFx.Props) {
	const runtimeRef = yield* RuntimeFx;
	const {
		scope,
		position: { x, y },
	} = location;
	const key = `${x}:${y}`;
	const placedItem = {
		...item,
		location,
	} satisfies RuntimeItemSchema.Type;

	yield* Ref.update(runtimeRef, (runtime) => {
		return match(scope)
			.with("board", () => {
				return {
					...runtime,
					board: {
						...runtime.board,
						cells: {
							...runtime.board.cells,
							[key]: placedItem,
						},
					},
				};
			})
			.with("inventory", () => {
				return {
					...runtime,
					inventory: {
						...runtime.inventory,
						cells: {
							...runtime.inventory.cells,
							[key]: placedItem,
						},
					},
				};
			})
			.exhaustive();
	});

	return placedItem;
});
