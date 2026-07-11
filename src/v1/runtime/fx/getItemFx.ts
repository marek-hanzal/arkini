import { Effect, Ref } from "effect";
import { match } from "ts-pattern";

import { ItemNotFoundError } from "~/v1/item/error/ItemNotFoundError";
import type { LocationSchema } from "~/v1/location/schema/LocationSchema";
import { RuntimeFx } from "~/v1/runtime/context/RuntimeFx";

export namespace getItemFx {
	export interface Props {
		location: LocationSchema.Type;
	}
}

/**
 * Reads one item from a concrete runtime location.
 */
export const getItemFx = Effect.fn("getItemFx")(function* ({ location }: getItemFx.Props) {
	const runtimeRef = yield* RuntimeFx;
	const runtime = yield* Ref.get(runtimeRef);
	const {
		scope,
		position: { x, y },
	} = location;
	const key = `${x}:${y}`;
	const item = match(scope)
		.with("board", () => {
			return runtime.board.cells[key];
		})
		.with("inventory", () => {
			return runtime.inventory.cells[key];
		})
		.exhaustive();

	if (item === undefined) {
		return yield* Effect.fail(
			new ItemNotFoundError({
				location,
			}),
		);
	}

	return item;
});
