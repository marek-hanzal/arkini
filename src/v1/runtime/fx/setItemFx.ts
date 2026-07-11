import { Effect, Ref } from "effect";

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
 * Transitional atomic item upsert used until dedicated runtime commands own
 * every mutation.
 */
export const setItemFx = Effect.fn("setItemFx")(function* ({ item, location }: setItemFx.Props) {
	const runtimeRef = yield* RuntimeFx;
	const placedItem = {
		...item,
		location,
	} satisfies RuntimeItemSchema.Type;

	yield* Ref.update(runtimeRef, (runtime) => {
		return {
			items: [
				...runtime.items.filter((candidate) => {
					const sameItem = candidate.id === placedItem.id;
					const sameLocation =
						candidate.location.scope === placedItem.location.scope &&
						candidate.location.position.x === placedItem.location.position.x &&
						candidate.location.position.y === placedItem.location.position.y;

					return !sameItem && !sameLocation;
				}),
				placedItem,
			],
		};
	});

	return placedItem;
});
