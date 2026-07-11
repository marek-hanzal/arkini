import { Effect, Ref } from "effect";
import { Array, Option, pipe } from "effect";

import { ItemNotFoundError } from "~/v1/item/error/ItemNotFoundError";
import type { LocationSchema } from "~/v1/location/schema/LocationSchema";
import { RuntimeFx } from "~/v1/runtime/context/RuntimeFx";

export namespace getItemFx {
	export interface Props {
		location: LocationSchema.Type;
	}
}

/**
 * Reads one item at a concrete runtime location.
 */
export const getItemFx = Effect.fn("getItemFx")(function* ({ location }: getItemFx.Props) {
	const runtimeRef = yield* RuntimeFx;
	const runtime = yield* Ref.get(runtimeRef);
	const item = pipe(
		runtime.items,
		Array.findFirst((item) => {
			return (
				item.location.scope === location.scope &&
				item.location.position.x === location.position.x &&
				item.location.position.y === location.position.y
			);
		}),
		Option.getOrUndefined,
	);

	if (item === undefined) {
		return yield* Effect.fail(
			new ItemNotFoundError({
				location,
			}),
		);
	}

	return item;
});
